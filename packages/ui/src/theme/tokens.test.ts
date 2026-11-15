import {
  baseDurations,
  contrastRatio,
  createTheme,
  hexToRgb,
  palettes,
  resolveThemeName,
  scaleDurations,
  type ColorTokens,
} from './tokens';

const AA_TEXT = 4.5;
const AA_UI = 3;

describe('palettes', () => {
  it('dark and light define exactly the same tokens', () => {
    expect(Object.keys(palettes.dark).sort()).toEqual(Object.keys(palettes.light).sort());
  });

  describe.each(['dark', 'light'] as const)('%s theme contrast (WCAG AA)', (name) => {
    const c: ColorTokens = palettes[name];

    it.each(['background', 'surface', 'surfaceRaised'] as const)(
      'text and textMuted on %s',
      (bg) => {
        expect(contrastRatio(c.text, c[bg])).toBeGreaterThanOrEqual(AA_TEXT);
        expect(contrastRatio(c.textMuted, c[bg])).toBeGreaterThanOrEqual(AA_TEXT);
      },
    );

    it('onAccent on accent', () => {
      expect(contrastRatio(c.onAccent, c.accent)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it.each(['accent', 'success', 'warning', 'danger', 'verified', 'generated'] as const)(
      '%s is visible on background and surface',
      (key) => {
        expect(contrastRatio(c[key], c.background)).toBeGreaterThanOrEqual(AA_UI);
        expect(contrastRatio(c[key], c.surface)).toBeGreaterThanOrEqual(AA_UI);
      },
    );
  });
});

describe('resolveThemeName', () => {
  it('honours an explicit preference', () => {
    expect(resolveThemeName('light', 'dark')).toBe('light');
    expect(resolveThemeName('dark', 'light')).toBe('dark');
  });

  it('follows the system when preference is "system"', () => {
    expect(resolveThemeName('system', 'light')).toBe('light');
    expect(resolveThemeName('system', 'dark')).toBe('dark');
  });

  it('defaults to dark when the system scheme is unknown', () => {
    expect(resolveThemeName('system', null)).toBe('dark');
    expect(resolveThemeName('system', undefined)).toBe('dark');
  });
});

describe('scaleDurations', () => {
  it('keeps base values at normal speed', () => {
    expect(scaleDurations('normal', false)).toEqual(baseDurations);
  });

  it('shortens every duration at fast speed', () => {
    const fast = scaleDurations('fast', false);
    for (const key of Object.keys(baseDurations) as (keyof typeof baseDurations)[]) {
      expect(fast[key]).toBeLessThan(baseDurations[key]);
      expect(fast[key]).toBeGreaterThan(0);
    }
  });

  it('zeroes everything when off or when OS reduce-motion is on', () => {
    for (const d of [scaleDurations('off', false), scaleDurations('normal', true)]) {
      expect(Object.values(d).every((v) => v === 0)).toBe(true);
    }
  });

  it('matches ТЗ §10 ranges at normal speed', () => {
    expect(baseDurations.move).toBeGreaterThanOrEqual(150);
    expect(baseDurations.move).toBeLessThanOrEqual(220);
    expect(baseDurations.capture).toBe(150);
    expect(baseDurations.wrongMove).toBe(250);
    expect(baseDurations.lineComplete).toBe(800);
  });
});

describe('createTheme', () => {
  it('builds a theme with the requested palette and flags disabled animations', () => {
    const t = createTheme('light', 'off');
    expect(t.colors).toBe(palettes.light);
    expect(t.animationsDisabled).toBe(true);
    expect(createTheme('dark').animationsDisabled).toBe(false);
  });
});

describe('hexToRgb', () => {
  it('parses short and long forms', () => {
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#0F1115')).toEqual([15, 17, 21]);
  });

  it('rejects invalid input', () => {
    expect(() => hexToRgb('red')).toThrow();
  });
});
