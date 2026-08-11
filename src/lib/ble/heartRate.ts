/**
 * Bluetooth GATT — Heart Rate Service parsing.
 *
 * Service        0x180D  Heart Rate
 * Characteristic 0x2A37  Heart Rate Measurement (notify)
 *
 * Layout of the Heart Rate Measurement value (Bluetooth SIG spec):
 *
 *   byte 0        flags
 *                   bit 0    HR value format   0 = uint8, 1 = uint16
 *                   bit 1-2  sensor contact    (2 = not supported, 3 = contact detected)
 *                   bit 3    energy expended present
 *                   bit 4    RR intervals present
 *   byte 1..       heart rate (uint8 or uint16, little endian)
 *   [2 bytes]      energy expended (uint16 LE) — only when bit 3 set
 *   [2 bytes]×N    RR intervals (uint16 LE, unit 1/1024 s) — only when bit 4 set
 *
 * The RR intervals are what makes a chest strap worth using: they carry
 * beat-to-beat timing at ~1 ms resolution, which is what RMSSD needs.
 */

export const HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
export const HEART_RATE_MEASUREMENT_CHAR = '00002a37-0000-1000-8000-00805f9b34fb';

/** 1/1024 s → ms */
const RR_UNIT_MS = 1000 / 1024;

export type SensorContact = 'unsupported' | 'no_contact' | 'contact';

export interface HeartRateMeasurement {
  /** Beats per minute reported by the device. */
  heartRate: number;
  /** Beat-to-beat intervals in ms. Empty when the device doesn't expose them. */
  rrIntervals: number[];
  sensorContact: SensorContact;
  energyExpended: number | null;
}

function readSensorContact(flags: number): SensorContact {
  // bits 1-2 taken together: 0/1 = not supported, 2 = no contact, 3 = contact
  const status = (flags >> 1) & 0b11;
  if (status === 2) return 'no_contact';
  if (status === 3) return 'contact';
  return 'unsupported';
}

/**
 * Parse a raw Heart Rate Measurement payload.
 * Returns null when the payload is empty or truncated mid-field.
 */
export function parseHeartRateMeasurement(bytes: Uint8Array): HeartRateMeasurement | null {
  if (bytes.length < 2) return null;

  const flags = bytes[0];
  const is16Bit = (flags & 0b1) !== 0;
  const hasEnergy = (flags & 0b1000) !== 0;
  const hasRR = (flags & 0b10000) !== 0;

  let offset = 1;

  if (is16Bit && bytes.length < offset + 2) return null;
  const heartRate = is16Bit ? bytes[offset] | (bytes[offset + 1] << 8) : bytes[offset];
  offset += is16Bit ? 2 : 1;

  let energyExpended: number | null = null;
  if (hasEnergy) {
    if (bytes.length < offset + 2) return null;
    energyExpended = bytes[offset] | (bytes[offset + 1] << 8);
    offset += 2;
  }

  const rrIntervals: number[] = [];
  if (hasRR) {
    // Trailing odd byte would be a malformed frame; ignore it rather than
    // fabricating an interval out of half a value.
    while (offset + 1 < bytes.length) {
      const raw = bytes[offset] | (bytes[offset + 1] << 8);
      rrIntervals.push(raw * RR_UNIT_MS);
      offset += 2;
    }
  }

  return {
    heartRate,
    rrIntervals,
    sensorContact: readSensorContact(flags),
    energyExpended,
  };
}

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decode the base64 characteristic value that react-native-ble-plx returns.
 * Implemented inline rather than via atob/Buffer so it behaves identically on
 * Hermes, on web and under plain node in tests.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, '');
  const out = new Uint8Array((clean.length * 3) >> 2);
  let bits = 0;
  let acc = 0;
  let idx = 0;

  for (let i = 0; i < clean.length; i++) {
    const value = B64_ALPHABET.indexOf(clean[i]);
    if (value === -1) continue;
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[idx++] = (acc >> bits) & 0xff;
    }
  }

  return out.subarray(0, idx);
}

/**
 * Physiological gate for a single RR interval: 300–2000 ms (30–200 bpm).
 * Straps emit occasional out-of-range values on motion artefacts.
 */
export function isPlausibleRR(rr: number): boolean {
  return rr >= 300 && rr <= 2000;
}
