package main

import "testing"

func TestHello(t *testing.T) {
	want := "Rosmarium CLI"
	if got := Hello(); got != want {
		t.Errorf("Hello() = %q, want %q", got, want)
	}
}
