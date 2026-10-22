package main

// Push-Erinnerungen (Web Push mit VAPID). Die App meldet ein Gerät in push_subs an,
// der Server prüft alle 5 Minuten, was fällig ist (siehe plan), und verschickt es.
// Einfache PocketBase-Server ohne diese Mac-App speichern Anmeldungen, schicken aber nichts.

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// Absender im VAPID-Schlüssel; Apple verlangt eine https- oder mailto-Adresse.
const pushSubscriber = "https://hfpvhrmbfw-alt.github.io/hugin-munin/"

type pusher struct {
	app       core.App
	pub, priv string
}

type vapidFile struct {
	Public  string `json:"publicKey"`
	Private string `json:"privateKey"`
}

// loadVapid liest die Schlüssel aus <dir>/vapid.json oder legt sie einmalig an.
// Neue Schlüssel würden alle Anmeldungen ungültig machen, deshalb bleiben sie liegen.
func loadVapid(dir string) (vapidFile, error) {
	path := filepath.Join(dir, "vapid.json")
	var v vapidFile
	if b, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(b, &v); err == nil && v.Public != "" && v.Private != "" {
			return v, nil
		}
	}
	priv, pub, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		return v, err
	}
	v = vapidFile{Public: pub, Private: priv}
	b, _ := json.Marshal(v)
	return v, os.WriteFile(path, b, 0o600)
}

func setupPush(app *pocketbase.PocketBase) {
	p := &pusher{app: app}

	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		keys, err := loadVapid(e.App.DataDir())
		if err != nil {
			e.App.Logger().Error("push: Schlüssel fehlen", "error", err)
			return e.Next()
		}
		p.pub, p.priv = keys.Public, keys.Private

		e.Router.GET("/api/hm/push-key", func(re *core.RequestEvent) error {
			return re.JSON(http.StatusOK, map[string]string{"publicKey": p.pub})
		})
		e.Router.POST("/api/hm/push-test", func(re *core.RequestEvent) error {
			n := p.send(re.Auth.Id, notice{User: re.Auth.Id, Key: "test", Title: "hugin & munin", Body: "So sehen Erinnerungen aus."})
			if n == 0 {
				return re.NotFoundError("no_subscription", nil)
			}
			return re.JSON(http.StatusOK, map[string]int{"sent": n})
		}).Bind(apis.RequireAuth("users"))

		e.App.Cron().MustAdd("hmReminders", "*/5 * * * *", func() { p.run(time.Now()) })
		return e.Next()
	})
}

// send schickt eine Nachricht an alle Geräte einer Person; abgelaufene Anmeldungen fliegen raus.
func (p *pusher) send(user string, n notice) int {
	if p.priv == "" {
		return 0
	}
	subs, err := p.app.FindAllRecords("push_subs", dbx.HashExp{"user": user})
	if err != nil {
		return 0
	}
	payload, _ := json.Marshal(map[string]string{"title": n.Title, "body": n.Body, "tag": n.Key, "url": "./"})
	sent := 0
	for _, s := range subs {
		res, err := webpush.SendNotification(payload, &webpush.Subscription{
			Endpoint: s.GetString("endpoint"),
			Keys:     webpush.Keys{P256dh: s.GetString("p256dh"), Auth: s.GetString("auth")},
		}, &webpush.Options{
			Subscriber:      pushSubscriber,
			VAPIDPublicKey:  p.pub,
			VAPIDPrivateKey: p.priv,
			TTL:             3600,
			Urgency:         webpush.UrgencyHigh,
		})
		if err != nil {
			p.app.Logger().Warn("push: senden fehlgeschlagen", "error", err)
			continue
		}
		io.Copy(io.Discard, res.Body)
		res.Body.Close()
		switch {
		case res.StatusCode == http.StatusNotFound || res.StatusCode == http.StatusGone:
			p.app.Delete(s)
		case res.StatusCode >= 400:
			p.app.Logger().Warn("push: abgelehnt", "status", res.StatusCode)
		default:
			sent++
		}
	}
	return sent
}

// run: fällige Erinnerungen aller Haushalte verschicken, jede nur einmal.
func (p *pusher) run(now time.Time) {
	app := p.app
	households, err := app.FindAllRecords("households")
	if err != nil {
		return
	}
	for _, h := range households {
		members := h.GetStringSlice("members")
		hasSubs := false
		for _, m := range members {
			if n, _ := app.CountRecords("push_subs", dbx.HashExp{"user": m}); n > 0 {
				hasSubs = true
				break
			}
		}
		if !hasSubs {
			continue
		}
		for _, n := range plan(now, members, p.events(h.Id), p.tasks(h.Id), p.contacts(h.Id)) {
			if _, err := app.FindFirstRecordByData("push_sent", "key", n.Key); err == nil {
				continue
			}
			if p.send(n.User, n) == 0 {
				continue
			}
			col, err := app.FindCollectionByNameOrId("push_sent")
			if err != nil {
				return
			}
			rec := core.NewRecord(col)
			rec.Set("key", n.Key)
			if err := app.Save(rec); err != nil {
				app.Logger().Warn("push: merken fehlgeschlagen", "error", err)
			}
		}
	}
	// Merker nach drei Tagen wegräumen.
	app.DB().NewQuery("DELETE FROM push_sent WHERE created < {:t}").
		Bind(dbx.Params{"t": now.UTC().Add(-72 * time.Hour).Format("2006-01-02 15:04:05.000Z")}).Execute()
}

func (p *pusher) find(collection, household string) []*core.Record {
	recs, err := p.app.FindRecordsByFilter(collection, "household = {:h} && deleted = false", "", 0, 0, dbx.Params{"h": household})
	if err != nil {
		return nil
	}
	return recs
}

func (p *pusher) events(household string) []remEvent {
	var out []remEvent
	for _, r := range p.find("events", household) {
		out = append(out, remEvent{
			ID: r.Id, Title: r.GetString("title"), StartDate: r.GetString("startDate"), StartTime: r.GetString("startTime"),
			Repeat: r.GetString("repeat"), Interval: r.GetInt("repeatInterval"), Until: r.GetString("repeatUntil"),
			People: r.GetStringSlice("people"),
		})
	}
	return out
}

func (p *pusher) tasks(household string) []remTask {
	lists := map[string]bool{}
	for _, l := range p.find("lists", household) {
		if (l.GetString("kind") == "tasks" || l.GetString("kind") == "project") && !l.GetBool("archived") {
			lists[l.Id] = true
		}
	}
	var out []remTask
	for _, r := range p.find("items", household) {
		if r.GetBool("done") || r.GetString("dueDate") == "" || !lists[r.GetString("list")] {
			continue
		}
		out = append(out, remTask{ID: r.Id, Title: r.GetString("title"), Due: r.GetString("dueDate"), Assignee: r.GetString("assignee")})
	}
	return out
}

func (p *pusher) contacts(household string) []remContact {
	var out []remContact
	for _, r := range p.find("contacts", household) {
		if b := r.GetString("birthday"); b != "" {
			out = append(out, remContact{Name: r.GetString("name"), Birthday: b})
		}
	}
	return out
}
