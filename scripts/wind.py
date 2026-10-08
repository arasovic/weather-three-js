"""Packs the latest GFS 10 m wind into a small file for the globe.

wind.bin: two planes of int8, u (eastward) then v (northward), in 0.5 m/s steps. Rows run
from 90° N to 90° S and columns eastward from 0° E, 1° apart (181 x 360).
wind.json: when the field is valid and which run it came from.

Usage: python scripts/wind.py OUT_DIR   (needs: pip install eccodes numpy)
"""

import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import eccodes
import numpy as np

FILTER = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_1p00.pl'
FIELDS = 'var_UGRD=on&var_VGRD=on&lev_10_m_above_ground=on'
STEP = 0.5


def fetch(now: datetime) -> tuple[bytes, datetime, int]:
    # A run reaches NOMADS about 3.5 h after it starts; walk back until one answers.
    for back in range(0, 24, 6):
        run = (now - timedelta(hours=back)).replace(minute=0, second=0, microsecond=0)
        run -= timedelta(hours=run.hour % 6)
        # The forecast hour nearest the middle of the six hours until the next update.
        hour = int((now + timedelta(hours=3) - run).total_seconds() / 3600 / 3 + 0.5) * 3
        url = f'{FILTER}?dir=%2Fgfs.{run:%Y%m%d}%2F{run:%H}%2Fatmos&file=gfs.t{run:%H}z.pgrb2.1p00.f{hour:03d}&{FIELDS}'
        try:
            with urllib.request.urlopen(url, timeout=60) as res:
                data = res.read()
        except urllib.error.HTTPError:
            continue
        if data[:4] == b'GRIB':
            return data, run, hour
    raise SystemExit('no GFS run answered in the last day')


def decode(data: bytes) -> dict[str, np.ndarray]:
    fields = {}
    offset = 0
    while offset < len(data):
        gid = eccodes.codes_new_from_message(data[offset:])
        offset += eccodes.codes_get(gid, 'totalLength')
        grid = [eccodes.codes_get(gid, k) for k in ('Ni', 'Nj', 'latitudeOfFirstGridPointInDegrees', 'longitudeOfFirstGridPointInDegrees')]
        if grid != [360, 181, 90, 0]:
            raise SystemExit(f'unexpected grid {grid}')
        fields[eccodes.codes_get(gid, 'shortName')] = eccodes.codes_get_values(gid).reshape(181, 360)
        eccodes.codes_release(gid)
    return fields


def main() -> None:
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    data, run, hour = fetch(datetime.now(timezone.utc))
    f = decode(data)
    u, v = f['10u'], f['10v']
    # A sanity check on the decoding: the world's mean 10 m wind is a few m/s.
    mean = float(np.hypot(u, v).mean())
    if not 3 < mean < 12:
        raise SystemExit(f'implausible mean wind {mean:.1f} m/s')
    packed = np.clip(np.rint(np.stack([u, v]) / STEP), -127, 127).astype(np.int8)
    (out / 'wind.bin').write_bytes(packed.tobytes())
    iso = lambda t: t.isoformat().replace('+00:00', 'Z')
    meta = {'valid': iso(run + timedelta(hours=hour)), 'run': iso(run), 'step': STEP}
    (out / 'wind.json').write_text(json.dumps(meta))
    print(f'wrote {out}: valid {meta["valid"]}, mean {mean:.1f} m/s')


if __name__ == '__main__':
    main()
