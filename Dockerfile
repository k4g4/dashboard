FROM imbios/bun-node as base
WORKDIR /home/bun/app

# unfortunately, this dependency does not work with bun!
# hence the need for a bun + node docker image...
RUN npm install -g @bitwarden/cli

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# # install with --production (exclude devDependencies)
# RUN mkdir -p /temp/prod
# COPY package.json bun.lockb /temp/prod/
# RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# compile server
RUN bun buildserver

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=prerelease /home/bun/app/dashboard .
COPY --from=prerelease /home/bun/app/pages pages
COPY --from=prerelease /home/bun/app/assets assets
COPY --from=prerelease /home/bun/app/build build

# create persistent storage directory (use -v with docker run)
RUN mkdir persist
RUN chown bun persist

# run the app
USER bun
EXPOSE 3000/tcp
ENV TIMEZONE=America/Chicago
ENTRYPOINT [ "./dashboard" ]