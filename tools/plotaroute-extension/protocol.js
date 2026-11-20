export function collectionAddress(value) {
  const id = String(value).match(
    /^(?:https:\/\/(?:www\.)?plotaroute\.com\/routecollection\/)?([1-9]\d*)\/?$/,
  )?.[1];
  if (!id) throw new Error("invalidCollection");
  return { id, url: `https://www.plotaroute.com/routecollection/${id}` };
}

export function routeIdentifier(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !["www.plotaroute.com", "plotaroute.com"].includes(url.hostname)
  ) {
    throw new Error("openRoute");
  }
  const id = url.pathname.match(/^\/route\/([1-9]\d*)\/?$/)?.[1];
  if (!id) throw new Error("openRoute");
  return id;
}

export function manifestFor(job) {
  return {
    format: "knut-vandrar-plotaroute",
    version: 1,
    collection: {
      id: job.id,
      url: job.url,
      name: job.title,
      route_names: job.names,
    },
    routes: job.routes
      .toSorted((a, b) => a.source_order - b.source_order)
      .map(({ source_id, source_order, filename, metadata }) => ({
        source_id,
        source_order,
        filename: filename.split(/[\\/]/).at(-1),
        metadata,
      })),
  };
}
