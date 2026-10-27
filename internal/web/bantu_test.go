package web

import (
	"strconv"
	"testing"

	"github.com/jasmiandre/new/internal/habit"
)

func itoa(n int64) string { return strconv.FormatInt(n, 10) }

func mustDate(t *testing.T, s string) habit.Date {
	t.Helper()
	d, err := habit.ParseDate(s)
	if err != nil {
		t.Fatalf("ParseDate(%q): %v", s, err)
	}
	return d
}
