export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/location") {
      const cf = request.cf ?? {};
      return Response.json({
        country: cf.country,
        continent: cf.continent,
        timezone: cf.timezone,
      });
    }

    return new Response("LoFiPix Edge", {
      headers: { "Content-Type": "text/plain" },
    });
  },
};
