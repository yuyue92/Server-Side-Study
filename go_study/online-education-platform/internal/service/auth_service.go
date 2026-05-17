package service

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"online-education-platform/internal/dto"
	"online-education-platform/internal/model"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// AuthService owns registration, login, and token generation logic.
type AuthService struct {
	db             *gorm.DB
	jwtSecret      []byte
	tokenExpiresIn time.Duration
}

// AuthResult is returned after register/login.
type AuthResult struct {
	Token string     `json:"token"`
	User  model.User `json:"user"`
}

// Claims is the custom JWT payload used by protected routes.
type Claims struct {
	UserID uint   `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func NewAuthService(db *gorm.DB, secret string, expireHours int) *AuthService {
	return &AuthService{
		db:             db,
		jwtSecret:      []byte(secret),
		tokenExpiresIn: time.Duration(expireHours) * time.Hour,
	}
}

func (s *AuthService) Register(req dto.RegisterRequest) (*AuthResult, error) {
	email := strings.TrimSpace(strings.ToLower(req.Email))
	username := strings.TrimSpace(req.Username)

	if err := s.ensureUniqueUser(email, username); err != nil {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user := model.User{
		Username:     username,
		Email:        email,
		PasswordHash: string(hash),
		Role:         req.Role,
		Status:       model.UserStatusActive,
	}

	if err := s.db.Create(&user).Error; err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	token, err := s.IssueToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResult{Token: token, User: user}, nil
}

func (s *AuthService) Login(req dto.LoginRequest) (*AuthResult, error) {
	email := strings.TrimSpace(strings.ToLower(req.Email))

	var user model.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("find user by email: %w", err)
	}

	if user.Status != model.UserStatusActive {
		return nil, ErrForbidden
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	token, err := s.IssueToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResult{Token: token, User: user}, nil
}

func (s *AuthService) IssueToken(user model.User) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: user.ID,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatUint(uint64(user.ID), 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.tokenExpiresIn)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return "", fmt.Errorf("sign jwt: %w", err)
	}
	return signed, nil
}

func (s *AuthService) ParseToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("unexpected signing method: %s", token.Method.Alg())
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}
	return claims, nil
}

func (s *AuthService) ensureUniqueUser(email, username string) error {
	var count int64

	if err := s.db.Model(&model.User{}).Where("email = ?", email).Count(&count).Error; err != nil {
		return fmt.Errorf("count email: %w", err)
	}
	if count > 0 {
		return ErrEmailExists
	}

	if err := s.db.Model(&model.User{}).Where("username = ?", username).Count(&count).Error; err != nil {
		return fmt.Errorf("count username: %w", err)
	}
	if count > 0 {
		return ErrUsernameExists
	}

	return nil
}
