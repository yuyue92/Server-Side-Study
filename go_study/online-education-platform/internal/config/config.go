package config

import (
	"os"
	"strconv"
)

// Config contains all runtime configuration used by the service.
type Config struct {
	ServerPort     string
	DatabasePath   string
	JWTSecret      string
	JWTExpireHours int
}

// Load builds the application configuration from environment variables.
// Every field has a development-friendly default so the project can run directly.
func Load() *Config {
	return &Config{
		ServerPort:     getEnv("APP_PORT", "8080"),
		DatabasePath:   getEnv("DB_PATH", "data/education.db"),
		JWTSecret:      getEnv("JWT_SECRET", "change-me-in-production"),
		JWTExpireHours: getEnvAsInt("JWT_EXPIRE_HOURS", 24),
	}
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func getEnvAsInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}
