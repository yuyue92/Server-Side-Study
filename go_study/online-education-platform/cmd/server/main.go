package main

import (
	"log"

	"online-education-platform/internal/config"
	"online-education-platform/internal/database"
	"online-education-platform/internal/router"
)

func main() {
	cfg := config.Load()

	db, err := database.Init(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("database init failed: %v", err)
	}

	engine := router.Setup(db, cfg)

	addr := ":" + cfg.ServerPort
	log.Printf("server started at http://127.0.0.1%s", addr)
	if err := engine.Run(addr); err != nil {
		log.Fatalf("server run failed: %v", err)
	}
}
