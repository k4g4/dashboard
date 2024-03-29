# 🛠️ Dashboard - A webpage for personalized utilities

This personalized website provides various tools for managing personal finances, passwords, shopping lists, and any other useful tools I might want in the future.
It utilizes almost all of Bun's built-in features, including a static file server, a Sqlite database, React front-end interfaces with Typescript JSX transpilation, Google OAuth and traditional log-ins, and efficient bundling and server-side compilation.
A sample Dockerfile is provided for containerization, but the buildscripts and buildserver commands allow for quick deployment in most environments.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun dev
```

To build webpage scripts:

```bash
bun buildscripts
```

To compile the server:

```bash
bun buildserver
```

This project was created using `bun init` in bun v1.0.35. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
