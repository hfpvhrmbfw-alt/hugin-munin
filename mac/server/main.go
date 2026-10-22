// hm-server: PocketBase mit den Hugin-&-Munin-Migrationen und -Hooks, dazu
// eingebautes Tailscale. Der Server ist damit selbst ein Gerät im Tailnet und
// unter https://<hostname>.<tailnet>.ts.net erreichbar, ohne Tailscale-App auf dem Mac.
//
// Aufruf wie PocketBase, z. B.:
//
//	hm-server serve --http=127.0.0.1:8090 --dir=… --hooksDir=… --migrationsDir=… --publicDir=… --tsHostname=hugin-munin
//
// Ohne --tsHostname läuft er nur lokal.
package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/tools/hook"
)

// Version wird beim Bauen gesetzt: -ldflags "-X main.Version=…"
var Version = "dev"

func main() {
	app := pocketbase.New()

	var hooksDir, migrationsDir, publicDir, tsHostname, tsDir string
	flags := app.RootCmd.PersistentFlags()
	flags.StringVar(&hooksDir, "hooksDir", besideBinary("pb_hooks"), "Ordner mit den JS-Hooks")
	flags.StringVar(&migrationsDir, "migrationsDir", besideBinary("pb_migrations"), "Ordner mit den JS-Migrationen")
	flags.StringVar(&publicDir, "publicDir", besideBinary("pb_public"), "Ordner mit der App (PWA)")
	flags.StringVar(&tsHostname, "tsHostname", "", "Gerätename im Tailnet; leer = Tailscale aus")
	flags.StringVar(&tsDir, "tsDir", "", "Ordner für den Tailscale-Zustand (Standard: <dir>/../tailscale)")
	app.RootCmd.ParseFlags(os.Args[1:])

	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      hooksDir,
	})

	if tsDir == "" {
		tsDir = filepath.Join(app.DataDir(), "..", "tailscale")
	}
	ts := newTailnet(tsHostname, tsDir)
	setupPush(app)

	// Zustand für die Mac-App, nur über 127.0.0.1 abrufbar.
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.GET("/api/hm/server-status", func(re *core.RequestEvent) error {
			if !isLoopback(re.Request) {
				return re.NotFoundError("", nil)
			}
			return re.JSON(http.StatusOK, map[string]any{
				"version":   Version,
				"tailscale": ts.status(re.Request.Context()),
			})
		})
		return e.Next()
	})

	app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			if !e.Router.HasRoute(http.MethodGet, "/{path...}") {
				e.Router.GET("/{path...}", apis.Static(os.DirFS(publicDir), true))
			}
			return e.Next()
		},
		Priority: 999,
	})

	// Nach e.Next() steht der fertige Handler fest; denselben bedient das Tailnet.
	app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			if err := e.Next(); err != nil {
				return err
			}
			return ts.start(e.Server.Handler, e.App.Logger())
		},
		Priority: -999,
	})

	app.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
		ts.close()
		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

func besideBinary(name string) string {
	exe, err := os.Executable()
	if err != nil {
		return name
	}
	return filepath.Join(filepath.Dir(exe), name)
}
