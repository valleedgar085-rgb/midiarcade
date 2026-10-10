import assert from "node:assert/strict";
import test from "node:test";
import { formatGate, formatLevel, formatMidiVelocity, formatVelocityScale } from "../src/ui/value-formatters.js";

test("formatGate formats standard gate values and feel descriptions", () => {
  assert.equal(formatGate(0.5), "50% · short");
  assert.equal(formatGate(0.79), "79% · short");
  assert.equal(formatGate(0.8), "80% · natural");
  assert.equal(formatGate(1.0), "100% · natural");
  assert.equal(formatGate(1.08), "108% · natural");
  assert.equal(formatGate(1.09), "109% · connected");
  assert.equal(formatGate(1.2), "120% · connected");
  assert.equal(formatGate(1.5), "150% · connected");
});

test("formatGate clamps gate values to bounds [0.25, 1.5]", () => {
  assert.equal(formatGate(0.1), "25% · short");
  assert.equal(formatGate(-0.5), "25% · short");
  assert.equal(formatGate(2.0), "150% · connected");
  assert.equal(formatGate(10), "150% · connected");
});

test("formatGate handles numeric strings and non-numeric / missing inputs", () => {
  assert.equal(formatGate("0.65"), "65% · short");
  assert.equal(formatGate("1.25"), "125% · connected");
  assert.equal(formatGate(0), "100% · natural");
  assert.equal(formatGate(undefined), "100% · natural");
  assert.equal(formatGate(null), "100% · natural");
  assert.equal(formatGate(NaN), "100% · natural");
  assert.equal(formatGate("invalid"), "100% · natural");
});

test("formatLevel formats volume gain into decibels and percentage", () => {
  assert.equal(formatLevel(1), "0.0 dB · 100%");
  assert.equal(formatLevel(0.5), "-6.0 dB · 50%");
  assert.equal(formatLevel(0.1), "-20.0 dB · 10%");
  assert.equal(formatLevel(0), "−∞ dB · muted");
  assert.equal(formatLevel(0.0001), "−∞ dB · muted");
});

test("formatLevel correctly handles threshold boundaries for muted level and near-zero decibels", () => {
  // Boundary around mute threshold (gain <= 0.0001)
  assert.equal(formatLevel(0.0001), "−∞ dB · muted");
  assert.equal(formatLevel("0.0001"), "−∞ dB · muted");
  assert.equal(formatLevel(0.00011), "-79.2 dB · 0%");

  // Boundary around 0.0 dB threshold (|decibels| < 0.05)
  assert.equal(formatLevel(0.996), "0.0 dB · 100%");
  assert.equal(formatLevel(0.99), "-0.1 dB · 99%");
});

test("formatLevel clamps gain to bounds [0, 1] and handles invalid inputs", () => {
  assert.equal(formatLevel(1.5), "0.0 dB · 100%");
  assert.equal(formatLevel(-0.5), "−∞ dB · muted");
  assert.equal(formatLevel("0.8"), "-1.9 dB · 80%");
  assert.equal(formatLevel(null), "−∞ dB · muted");
  assert.equal(formatLevel(undefined), "−∞ dB · muted");
  assert.equal(formatLevel(NaN), "−∞ dB · muted");
  assert.equal(formatLevel("abc"), "−∞ dB · muted");
});

test("formatVelocityScale formats scale values and feel classifications", () => {
  assert.equal(formatVelocityScale(0.5), "×0.50 · soft");
  assert.equal(formatVelocityScale(0.81), "×0.81 · soft");
  assert.equal(formatVelocityScale(0.82), "×0.82 · balanced");
  assert.equal(formatVelocityScale(1.0), "×1.00 · balanced");
  assert.equal(formatVelocityScale(1.12), "×1.12 · balanced");
  assert.equal(formatVelocityScale(1.13), "×1.13 · strong");
  assert.equal(formatVelocityScale(1.5), "×1.50 · strong");
});

test("formatVelocityScale clamps scale bounds [0.5, 1.5] and handles invalid inputs", () => {
  assert.equal(formatVelocityScale(0.2), "×0.50 · soft");
  assert.equal(formatVelocityScale(2.0), "×1.50 · strong");
  assert.equal(formatVelocityScale("0.7"), "×0.70 · soft");
  assert.equal(formatVelocityScale(undefined), "×1.00 · balanced");
  assert.equal(formatVelocityScale(NaN), "×1.00 · balanced");
});

test("formatMidiVelocity formats velocity integer and feel descriptions", () => {
  assert.equal(formatMidiVelocity(1), "1 · soft");
  assert.equal(formatMidiVelocity(40), "40 · soft");
  assert.equal(formatMidiVelocity(41), "41 · balanced");
  assert.equal(formatMidiVelocity(90), "90 · balanced");
  assert.equal(formatMidiVelocity(91), "91 · strong");
  assert.equal(formatMidiVelocity(127), "127 · strong");
});

test("formatMidiVelocity clamps velocity bounds [1, 127] and rounds fractional values", () => {
  assert.equal(formatMidiVelocity(0), "1 · soft");
  assert.equal(formatMidiVelocity(-10), "1 · soft");
  assert.equal(formatMidiVelocity(150), "127 · strong");
  assert.equal(formatMidiVelocity(64.6), "65 · balanced");
  assert.equal(formatMidiVelocity("80"), "80 · balanced");
  assert.equal(formatMidiVelocity(undefined), "1 · soft");
  assert.equal(formatMidiVelocity(NaN), "1 · soft");
});
