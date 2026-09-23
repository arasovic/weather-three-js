"""Fetches the GFS forecast hour nearest to now from NOMADS and packs it into PNGs.

clouds.png: R/G/B = low/middle/high cloud cover (0-100 % -> 0-255).
wind.png: R/G = 10 m wind u/v (-50..50 m/s -> 0-255), B unused.
Rows run north to south and columns west to east from 180° W, 0.25° apart (1440 x 721).

Usage: python scripts/gfs.py OUT_DIR   (needs: pip install eccodes numpy pillow)
"""

import json
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import eccodes
import numpy as np
from PIL import Image

FILTER = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl'
FIELDS = (
    'var_LCDC=on&var_MCDC=on&var_HCDC=on&var_UGRD=on&var_VGRD=on&lev_low_cloud_layer=on'
    '&lev_middle_cloud_layer=on&lev_high_cloud_layer=on&lev_10_m_above_ground=on'
)
WIND = 50.0


def fetch(now: datetime) -> tuple[bytes, datetime, int]:
    # A cycle appears on NOMADS about 3.5 h after its run time; walk back until one answers.
    for back in range(0, 24, 6):
        cycle = (now - timedelta(hours=back)).replace(minute=0, second=0, microsecond=0)
        cycle -= timedelta(hours=cycle.hour % 6)
        hour = round((now - cycle).total_seconds() / 3600)
        url = (
            f'{FILTER}?dir=%2Fgfs.{cycle:%Y%m%d}%2F{cycle:%H}%2Fatmos'
            f'&file=gfs.t{cycle:%H}z.pgrb2.0p25.f{hour:03d}&{FIELDS}'
        )
        try:
            with urllib.request.urlopen(url, timeout=60) as res:
                data = res.read()
            if data[:4] == b'GRIB':
                return data, cycle, hour
        except urllib.error.HTTPError:
            pass
    raise SystemExit('no GFS cycle available in the last day')


def decode(data: bytes) -> dict[str, np.ndarray]:
    fields = {}
    offset = 0
    while offset < len(data):
        gid = eccodes.codes_new_from_message(data[offset:])
        length = eccodes.codes_get(gid, 'totalLength')
        name = eccodes.codes_get(gid, 'shortName')
        instant = eccodes.codes_get(gid, 'stepType') == 'instant'
        ni, nj = eccodes.codes_get(gid, 'Ni'), eccodes.codes_get(gid, 'Nj')
        grid = eccodes.codes_get_values(gid).reshape(nj, ni)
        # GFS columns start at 0° E; roll so the image starts at 180° W.
        # Cloud layers also come as 6 h averages; keep the instantaneous value.
        if instant:
            fields[name] = np.roll(grid, ni // 2, axis=1)
        eccodes.codes_release(gid)
        offset += length
    return fields


def main() -> None:
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    data, cycle, hour = fetch(datetime.now(timezone.utc))
    f = decode(data)
    to_byte = lambda a, lo, hi: np.clip((a - lo) / (hi - lo) * 255 + 0.5, 0, 255).astype(np.uint8)
    cover = [to_byte(f[name], 0, 100) for name in ('lcc', 'mcc', 'hcc')]
    Image.fromarray(np.dstack(cover), 'RGB').save(out / 'clouds.png', optimize=True)
    u, v = (to_byte(f[name], -WIND, WIND) for name in ('10u', '10v'))
    Image.fromarray(np.dstack([u, v, np.zeros_like(u)]), 'RGB').save(out / 'wind.png', optimize=True)
    valid = cycle + timedelta(hours=hour)
    meta = {'valid': valid.isoformat().replace('+00:00', 'Z'), 'cycle': cycle.isoformat().replace('+00:00', 'Z'), 'wind': WIND}
    (out / 'gfs.json').write_text(json.dumps(meta))
    print(f'wrote {out} valid {meta["valid"]}')


if __name__ == '__main__':
    main()
