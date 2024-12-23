---
title: "Setting up OCI8 and Oracle XE with Docker on macOS"
date: 2024-12-23T19:40:57+01:00
tags: ["oci8", "macos", "docker", "colima", "php""]
draft: false
---

Integrating OCI8 with a PHP environment can be challenging, but recent updates have simplified the process significantly. Follow this guide to get everything set up seamlessly.

## Adding OCI8 support to PHP

Oracle has streamlined the process for adding OCI8 support to PHP. Clear, user-friendly instructions are available in [this Gist](https://gist.github.com/syahzul/d61d8ccea7c5959a84ed52d14159d8a9). Follow the steps outlined to prepare your PHP environment for OCI8.

## Setting up Oracle XE in Docker

Once your PHP environment is ready, you can move on to Docker setup. We'll use the Oracle XE image available on Docker Hub: [gvenzl/oracle-xe](https://hub.docker.com/r/gvenzl/oracle-xe).

### Installing Colima

First, ensure you have [Colima](https://github.com/abiosoft/colima#installation) installed. Installation is straightforward using Homebrew:

```bash
brew install colima
```

After installing Colima, start it with the following command:

```bash
colima start --arch x86_64 --memory 4
```

### Configuring Docker Context

Next, switch the Docker context to Colima:

```bash
docker context use colima
```

### Running the Oracle XE Docker Image

Finally, run the Oracle XE container using the command below:

```bash
docker run -d --name oracle-xe -p 1521:1521 \
    -e ORACLE_RANDOM_PASSWORD=true \
    -e APP_USER=ORACLE \
    -e APP_USER_PASSWORD=ORACLE \
    gvenzl/oracle-xe
```

## Conclusion

That’s it! With OCI8 support in PHP and Oracle XE running in Docker, your environment is ready. 