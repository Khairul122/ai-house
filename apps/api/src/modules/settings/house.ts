// Profil kantor yang tampil di dashboard: nama, dan lokasi untuk cuaca nyata. Diatur lewat .env.
export interface HouseProfile {
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

const num = (raw: string | undefined, fallback: number) => {
  const n = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(n) ? n : fallback;
};

export function getHouseProfile(
  env: NodeJS.ProcessEnv = process.env,
): HouseProfile {
  return {
    name: env.HOUSE_NAME?.trim() || "Synectra AI House",
    city: env.HOUSE_CITY?.trim() || "Bandung",
    latitude: num(env.HOUSE_LATITUDE, -6.917),
    longitude: num(env.HOUSE_LONGITUDE, 107.619),
    timezone: env.HOUSE_TIMEZONE?.trim() || "Asia/Jakarta",
  };
}
