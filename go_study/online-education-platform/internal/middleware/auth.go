package middleware

import (
	"net/http"
	"strings"

	"online-education-platform/internal/response"
	"online-education-platform/internal/service"

	"github.com/gin-gonic/gin"
)

const (
	ContextUserIDKey = "user_id"
	ContextRoleKey   = "role"
)

// Auth verifies JWT bearer tokens and injects the current user's identity.
func Auth(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := strings.TrimSpace(c.GetHeader("Authorization"))
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			response.Error(c, http.StatusUnauthorized, "missing or invalid Authorization header")
			c.Abort()
			return
		}

		tokenString := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		claims, err := authService.ParseToken(tokenString)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "invalid or expired token")
			c.Abort()
			return
		}

		c.Set(ContextUserIDKey, claims.UserID)
		c.Set(ContextRoleKey, claims.Role)
		c.Next()
	}
}

// RequireRole ensures the caller has the expected business role.
func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		value, ok := c.Get(ContextRoleKey)
		if !ok || value != role {
			response.Error(c, http.StatusForbidden, "insufficient permissions")
			c.Abort()
			return
		}
		c.Next()
	}
}

// CurrentUserID extracts the authenticated user ID from Gin context.
func CurrentUserID(c *gin.Context) uint {
	value, ok := c.Get(ContextUserIDKey)
	if !ok {
		return 0
	}
	id, ok := value.(uint)
	if !ok {
		return 0
	}
	return id
}
