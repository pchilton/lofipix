export default {
  async fetch(request) {
    return new Response("LoFiPix edge via Github Action", {
      headers: { "Content-Type": "text/plain" }
    });
  },
};
