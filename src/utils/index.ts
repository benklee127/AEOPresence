


export function createPageUrl(pageName: string) {
    // Split the path from query parameters to preserve query param case sensitivity
    const [path, ...queryParts] = pageName.split('?');
    const query = queryParts.join('?');
    const lowercasePath = path.toLowerCase().replace(/ /g, '-');
    return query ? `/${lowercasePath}?${query}` : `/${lowercasePath}`;
}