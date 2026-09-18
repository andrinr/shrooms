(function () {
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const monthDistance = (month, active) => Math.min(...active.map(m => Math.min(Math.abs(month - m), 12 - Math.abs(month - m))));

  function score(site, species, weather, date = new Date()) {
    const month = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', month: 'numeric' }).format(date));
    const habitat = species.habitat[site.habitat] || 0.4;
    const distance = monthDistance(month, species.months);
    const season = distance === 0 ? 1 : distance === 1 ? 0.42 : 0.08;
    let moisture = null, temperature = null;
    if (weather) {
      const rain = clamp((weather.rain7 - 4) / 34);
      const soil = Number.isFinite(weather.soil) ? clamp((weather.soil - 0.15) / 0.25) : rain;
      const local = site.moisture === 'wetter' ? 0.08 : site.moisture === 'drier' ? -0.08 : 0;
      moisture = clamp(0.55 * soil + 0.45 * rain + local);
      const [low, high] = species.temp;
      const t = weather.temp7;
      temperature = t < low ? clamp(1 - (low - t) / 11) : t > high ? clamp(1 - (t - high) / 11) : 1;
    }
    const rawValue = weather
      ? Math.round(100 * (0.45 * habitat + 0.25 * moisture + 0.15 * temperature + 0.15 * season))
      : Math.round(100 * (0.75 * habitat + 0.25 * season));
    const value = Math.min(95, rawValue);
    return { value, habitat, moisture, temperature, season, live: Boolean(weather) };
  }

  window.MYCO_SCORE = { score };
})();
