FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/package_site.cjs scripts/package_site.cjs
COPY index.html styles.css favicon.svg forest-magic.svg .nojekyll LICENSE THIRD_PARTY_NOTICES.md ./
COPY src src
COPY vendor vendor
COPY data data
RUN node scripts/package_site.cjs

FROM node:24-alpine
ENV NODE_ENV=production PORT=3000 STORAGE_DIR=/app/storage
WORKDIR /app
COPY --from=build /app/_site ./_site
COPY --from=build /app/data ./data
COPY --from=build /app/src ./src
COPY server server
COPY scripts/backup.cjs scripts/backup.cjs
COPY package.json package-lock.json ./
RUN mkdir -p storage && chown node:node storage
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.cjs"]
