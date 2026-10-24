package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"tailscale.com/tsnet"
)

// tailnet bindet den PocketBase-Handler über tsnet ins Tailnet ein:
// HTTPS auf Port 443 (Zertifikat von Tailscale), Port 80 leitet dorthin um.
type tailnet struct {
	hostname string
	srv      *tsnet.Server

	mu      sync.Mutex
	url     string // https://<name>.<tailnet>.ts.net, sobald HTTPS bereitsteht
	problem string // letzter Fehler, z. B. HTTPS in der Tailscale-Verwaltung aus
}

func newTailnet(hostname, dir string) *tailnet {
	t := &tailnet{hostname: hostname}
	if hostname != "" {
		t.srv = &tsnet.Server{
			Hostname: hostname,
			Dir:      dir,
			Logf:     func(string, ...any) {}, // Tailscale-Interna nicht ins Protokoll
		}
	}
	return t
}

func (t *tailnet) start(handler http.Handler, logger *slog.Logger) error {
	if t.srv == nil {
		return nil
	}
	t.srv.UserLogf = func(format string, args ...any) {
		logger.Info("tailscale: " + strings.TrimSpace(fmt.Sprintf(format, args...)))
	}
	if err := t.srv.Start(); err != nil {
		return err
	}
	go t.serve(handler, logger)
	return nil
}

// serve wartet, bis das Gerät angemeldet ist, und versucht HTTPS so lange,
// bis MagicDNS und HTTPS-Zertifikate im Tailnet eingeschaltet sind.
func (t *tailnet) serve(handler http.Handler, logger *slog.Logger) {
	for {
		err := t.fetchCert()
		var ln net.Listener
		if err == nil {
			ln, err = t.srv.ListenTLS("tcp", ":443")
		}
		if err == nil {
			t.ready()
			go t.redirectHTTP()
			err = (&http.Server{Handler: handler, ReadHeaderTimeout: 30 * time.Second}).Serve(ln)
		}
		if errors.Is(err, net.ErrClosed) || errors.Is(err, http.ErrServerClosed) {
			return
		}
		t.setProblem(err)
		logger.Warn("tailscale: HTTPS nicht bereit", "error", err)
		time.Sleep(30 * time.Second)
	}
}

// fetchCert holt das Zertifikat vor dem ersten Aufruf. Sonst holt tsnet es erst,
// wenn ein Handy die Seite öffnet, und das kann beim ersten Mal scheitern.
func (t *tailnet) fetchCert() error {
	domains := t.srv.CertDomains()
	if len(domains) == 0 {
		return errors.New("noch keine https-adresse: magicdns und https certificates einschalten")
	}
	lc, err := t.srv.LocalClient()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	if _, _, err := lc.CertPair(ctx, domains[0]); err != nil {
		return fmt.Errorf("zertifikat für %s: %w", domains[0], err)
	}
	return nil
}

func (t *tailnet) redirectHTTP() {
	ln, err := t.srv.Listen("tcp", ":80")
	if err != nil {
		return
	}
	http.Serve(ln, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "https://"+r.Host+r.URL.RequestURI(), http.StatusMovedPermanently)
	}))
}

func (t *tailnet) ready() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.problem = ""
	if domains := t.srv.CertDomains(); len(domains) > 0 {
		t.url = "https://" + domains[0]
	}
}

func (t *tailnet) setProblem(err error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.problem = err.Error()
}

// status meldet der Mac-App, was zu tun ist:
// state "Off" (kein Tailscale), "NeedsLogin" (authURL öffnen), "Running" (url teilen).
func (t *tailnet) status(ctx context.Context) map[string]any {
	out := map[string]any{"hostname": t.hostname, "state": "Off"}
	if t.srv == nil {
		return out
	}
	t.mu.Lock()
	out["url"], out["problem"] = t.url, t.problem
	t.mu.Unlock()

	lc, err := t.srv.LocalClient()
	if err != nil {
		out["state"] = "Starting"
		return out
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	st, err := lc.StatusWithoutPeers(ctx)
	if err != nil {
		out["state"] = "Starting"
		return out
	}
	out["state"] = st.BackendState
	out["authURL"] = st.AuthURL
	if st.CurrentTailnet != nil {
		out["tailnet"] = st.CurrentTailnet.Name
	}
	return out
}

func (t *tailnet) close() {
	if t.srv != nil {
		t.srv.Close()
	}
}

func isLoopback(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return false
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
