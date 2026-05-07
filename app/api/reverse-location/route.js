import { NextResponse } from 'next/server';

function pickBarangay(address = {}) {
  return (
    address.suburb
    || address.neighbourhood
    || address.village
    || address.hamlet
    || address.quarter
    || address.city_district
    || address.town
    || ''
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const latitude = Number(searchParams.get('lat'));
  const longitude = Number(searchParams.get('lon'));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: 'Invalid coordinates.' }, { status: 400 });
  }

  const upstreamUrl = new URL('https://nominatim.openstreetmap.org/reverse');
  upstreamUrl.searchParams.set('format', 'jsonv2');
  upstreamUrl.searchParams.set('lat', String(latitude));
  upstreamUrl.searchParams.set('lon', String(longitude));
  upstreamUrl.searchParams.set('zoom', '18');
  upstreamUrl.searchParams.set('addressdetails', '1');

  try {
    const response = await fetch(upstreamUrl, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'CitiSense/1.0 local civic feedback location picker',
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Unable to resolve location.' }, { status: response.status });
    }

    const data = await response.json();
    const barangay = pickBarangay(data.address);

    return NextResponse.json({
      barangay,
      label: barangay ? `Barangay ${barangay}` : data.display_name || '',
      displayName: data.display_name || '',
      latitude,
      longitude,
    });
  } catch {
    return NextResponse.json({ error: 'Unable to resolve location.' }, { status: 502 });
  }
}
