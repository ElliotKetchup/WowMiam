/** A QR code drawn with plain views (no SVG module needed): one row of runs per line of modules. */
import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { View } from 'react-native';

import { C } from '@/lib/theme';

export function QrCode({ value, size }: { value: string; size: number }) {
  const rows = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    return Array.from({ length: n }, (_, r) => {
      const runs: { dark: boolean; len: number }[] = [];
      for (let c = 0; c < n; c++) {
        const dark = qr.isDark(r, c);
        const last = runs.at(-1);
        if (last && last.dark === dark) last.len++;
        else runs.push({ dark, len: 1 });
      }
      return runs;
    });
  }, [value]);
  const cell = Math.floor(size / rows.length);
  return (
    <View style={{ width: cell * rows.length, height: cell * rows.length, backgroundColor: C.tile }} accessibilityRole="image" accessibilityLabel="QR code de l’invitation">
      {rows.map((runs, r) => (
        <View key={r} style={{ flexDirection: 'row', height: cell }}>
          {runs.map((run, i) => (
            <View key={i} style={{ width: run.len * cell, height: cell, backgroundColor: run.dark ? C.ink : C.tile }} />
          ))}
        </View>
      ))}
    </View>
  );
}
