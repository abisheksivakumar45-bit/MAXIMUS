# MAXIMUS frontend image (development server with hot reload).
# Production static hosting is intentionally out of scope until later phases.
FROM node:24-alpine

WORKDIR /app

# Install dependencies using the committed lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host makes the dev server reachable from outside the container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
