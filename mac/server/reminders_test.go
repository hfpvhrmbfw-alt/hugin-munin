package main

import (
	"testing"
	"time"
)

func at(s string) time.Time {
	t, _ := time.ParseInLocation("2006-01-02 15:04", s, time.Local)
	return t
}

func TestStartsOn(t *testing.T) {
	cases := []struct {
		ev   remEvent
		day  string
		want bool
	}{
		{remEvent{StartDate: "2026-10-20", Repeat: "weekly", Interval: 2}, "2026-11-03", true},
		{remEvent{StartDate: "2026-10-20", Repeat: "weekly", Interval: 2}, "2026-10-27", false},
		{remEvent{StartDate: "2026-01-31", Repeat: "monthly", Interval: 1}, "2026-04-30", false},
		{remEvent{StartDate: "2026-01-31", Repeat: "monthly", Interval: 1}, "2026-05-31", true},
		{remEvent{StartDate: "2024-02-29", Repeat: "yearly", Interval: 1}, "2028-02-29", true},
		{remEvent{StartDate: "2026-10-20", Repeat: "daily", Interval: 1, Until: "2026-10-22"}, "2026-10-23", false},
		{remEvent{StartDate: "2026-10-20"}, "2026-10-20", true},
	}
	for _, c := range cases {
		if got := startsOn(c.ev, c.day); got != c.want {
			t.Errorf("startsOn(%+v, %s) = %v", c.ev, c.day, got)
		}
	}
}

func TestPlan(t *testing.T) {
	members := []string{"anna", "ben"}
	events := []remEvent{
		{ID: "e1", Title: "Training", StartDate: "2026-10-20", StartTime: "18:00", Repeat: "weekly", Interval: 1, People: []string{"ben"}},
		{ID: "e2", Title: "Ferien", StartDate: "2026-10-27"},
	}
	tasks := []remTask{
		{ID: "t1", Title: "Müll", Due: "2026-10-27"},
		{ID: "t2", Title: "Steuer", Due: "2026-10-20", Assignee: "anna"},
	}
	contacts := []remContact{{Name: "Oma", Birthday: "10-27"}}

	got := plan(at("2026-10-27 07:35"), members, events, tasks, contacts)
	if len(got) != 2 {
		t.Fatalf("Überblick: %+v", got)
	}
	for _, n := range got {
		if n.User == "anna" && n.Body != "Ferien · 1 aufgabe fällig · 1 aufgabe überfällig · geburtstag: Oma" {
			t.Errorf("anna: %q", n.Body)
		}
		if n.User == "ben" && n.Body != "Ferien, 18:00 Training · 1 aufgabe fällig · geburtstag: Oma" {
			t.Errorf("ben: %q", n.Body)
		}
	}

	got = plan(at("2026-10-27 17:40"), members, events, tasks, contacts)
	if len(got) != 1 || got[0].User != "ben" || got[0].Key != "ev/e1/2026-10-27/ben" || got[0].Body != "heute um 18:00" {
		t.Fatalf("Termin: %+v", got)
	}
	if got := plan(at("2026-10-27 17:00"), members, events, tasks, contacts); len(got) != 0 {
		t.Fatalf("zu früh: %+v", got)
	}
}
