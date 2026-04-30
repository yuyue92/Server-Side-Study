package main

import (
	"flag"
	"log"
	"net/http"
	"os"

	"student-system/internal/db"
	"student-system/internal/handlers"
)

func main() {
	addr := flag.String("addr", ":8080", "HTTP server address")
	dsn := flag.String("db", "./data/students.db", "SQLite database file path")
	flag.Parse()

	// 确保数据目录存在
	if err := os.MkdirAll("./data", 0755); err != nil {
		log.Fatalf("failed to create data dir: %v", err)
	}

	if err := db.Init(*dsn); err != nil {
		log.Fatalf("database init failed: %v", err)
	}

	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("/api/students/", handlers.StudentRouter)
	mux.HandleFunc("/api/students", handlers.StudentRouter)
	mux.HandleFunc("/api/stats", handlers.GetStats)

	// Static files
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./web/static"))))

	// SPA fallback → index.html
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./web/templates/index.html")
	})

	// CORS middleware for development
	handler := corsMiddleware(mux)

	log.Printf("🎓 学生信息系统启动成功 → http://localhost%s\n", *addr)
	if err := http.ListenAndServe(*addr, handler); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
