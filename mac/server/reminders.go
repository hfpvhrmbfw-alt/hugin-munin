package main

// Erinnerungen planen: rein rechnend, ohne Datenbank und Netz, damit es sich testen lässt.
// Die Wiederholungsregeln entsprechen occurrences/nthStart in src/logic.js.

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

type remEvent struct {
	ID, Title, StartDate, StartTime, Repeat, Until string
	Interval                                       int
	People                                         []string
}

type remTask struct {
	ID, Title, Due, Assignee string
}

type remContact struct {
	Name, Birthday string // Birthday 'MM-DD'
}

type notice struct {
	User, Key, Title, Body string
}

const (
	eventLead   = 30        // Minuten vor einem Termin
	digestFrom  = 7*60 + 30 // Tagesüberblick ab 7:30 …
	digestUntil = 11 * 60   // … bis 11 Uhr, falls der Server früher aus war
)

func civil(iso string) (time.Time, bool) {
	t, err := time.Parse("2006-01-02", iso)
	return t, err == nil
}

func daysInMonth(y int, m time.Month) int {
	return time.Date(y, m+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

// nthStart: Startdatum des k-ten Vorkommens oder "" (Datum gibt es nicht, z. B. 31. im April).
func nthStart(ev remEvent, k int) string {
	start, ok := civil(ev.StartDate)
	if !ok {
		return ""
	}
	interval := ev.Interval
	if interval < 1 {
		interval = 1
	}
	step := interval * k
	switch ev.Repeat {
	case "daily":
		return start.AddDate(0, 0, step).Format("2006-01-02")
	case "weekly":
		return start.AddDate(0, 0, 7*step).Format("2006-01-02")
	case "monthly", "yearly":
		months := step
		if ev.Repeat == "yearly" {
			months = 12 * step
		}
		total := start.Year()*12 + int(start.Month()) - 1 + months
		y, m := total/12, time.Month(total%12+1)
		if start.Day() > daysInMonth(y, m) {
			return ""
		}
		return time.Date(y, m, start.Day(), 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	default:
		if k == 0 {
			return ev.StartDate
		}
		return ""
	}
}

// startsOn: beginnt ein Vorkommen des Termins an diesem Tag?
func startsOn(ev remEvent, day string) bool {
	if ev.StartDate > day || (ev.Until != "" && ev.Until < day) {
		return false
	}
	if ev.Repeat == "" || ev.Repeat == "none" {
		return ev.StartDate == day
	}
	start, _ := civil(ev.StartDate)
	target, _ := civil(day)
	days := int(target.Sub(start).Hours() / 24)
	interval := ev.Interval
	if interval < 1 {
		interval = 1
	}
	switch ev.Repeat {
	case "daily":
		return days%interval == 0
	case "weekly":
		return days%(7*interval) == 0
	}
	// monatlich/jährlich: k in der Nähe ausrechnen und prüfen
	months := (target.Year()*12 + int(target.Month())) - (start.Year()*12 + int(start.Month()))
	per := interval
	if ev.Repeat == "yearly" {
		per = 12 * interval
	}
	if months%per != 0 {
		return false
	}
	return nthStart(ev, months/per) == day
}

func minutesOf(hhmm string) int {
	var h, m int
	if _, err := fmt.Sscanf(hhmm, "%d:%d", &h, &m); err != nil {
		return -1
	}
	return h*60 + m
}

func involves(people []string, user string) bool {
	if len(people) == 0 {
		return true
	}
	for _, p := range people {
		if p == user {
			return true
		}
	}
	return false
}

// plan: welche Erinnerungen jetzt fällig sind. Doppelte verhindert der Aufrufer über Key.
func plan(now time.Time, members []string, events []remEvent, tasks []remTask, contacts []remContact) []notice {
	today := now.Format("2006-01-02")
	nowMin := now.Hour()*60 + now.Minute()
	var out []notice

	var todays []remEvent
	for _, ev := range events {
		if startsOn(ev, today) {
			todays = append(todays, ev)
		}
	}
	sort.Slice(todays, func(i, j int) bool { return todays[i].StartTime < todays[j].StartTime })

	for _, ev := range todays {
		if ev.StartTime == "" {
			continue
		}
		diff := minutesOf(ev.StartTime) - nowMin
		if diff < 0 || diff > eventLead {
			continue
		}
		for _, u := range members {
			if !involves(ev.People, u) {
				continue
			}
			title := ev.Title
			if title == "" {
				title = "Termin"
			}
			out = append(out, notice{User: u, Key: "ev/" + ev.ID + "/" + today + "/" + u, Title: title, Body: "heute um " + ev.StartTime})
		}
	}

	if nowMin < digestFrom || nowMin >= digestUntil {
		return out
	}
	var birthdays []string
	for _, c := range contacts {
		if c.Birthday != "" && c.Birthday == today[5:] {
			birthdays = append(birthdays, c.Name)
		}
		// 29.02. in Nicht-Schaltjahren am 28.02.
		if c.Birthday == "02-29" && today[5:] == "02-28" && daysInMonth(now.Year(), time.February) == 28 {
			birthdays = append(birthdays, c.Name)
		}
	}
	for _, u := range members {
		var parts []string
		var evs []string
		for _, ev := range todays {
			if involves(ev.People, u) {
				if ev.StartTime != "" {
					evs = append(evs, ev.StartTime+" "+ev.Title)
				} else {
					evs = append(evs, ev.Title)
				}
			}
		}
		due, overdue := 0, 0
		for _, t := range tasks {
			if t.Due == "" || t.Due > today || (t.Assignee != "" && t.Assignee != u) {
				continue
			}
			if t.Due == today {
				due++
			} else {
				overdue++
			}
		}
		if len(evs) > 0 {
			parts = append(parts, strings.Join(evs, ", "))
		}
		if due == 1 {
			parts = append(parts, "1 aufgabe fällig")
		} else if due > 1 {
			parts = append(parts, fmt.Sprintf("%d aufgaben fällig", due))
		}
		if overdue == 1 {
			parts = append(parts, "1 aufgabe überfällig")
		} else if overdue > 1 {
			parts = append(parts, fmt.Sprintf("%d aufgaben überfällig", overdue))
		}
		if len(birthdays) > 0 {
			parts = append(parts, "geburtstag: "+strings.Join(birthdays, ", "))
		}
		if len(parts) > 0 {
			out = append(out, notice{User: u, Key: "digest/" + today + "/" + u, Title: "heute", Body: strings.Join(parts, " · ")})
		}
	}
	return out
}
