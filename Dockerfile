# ── Build stage: install Knuth via Conan (prebuilt Haswell binary) ──
FROM python:3.11-slim AS build

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates curl unzip git \
        build-essential cmake pkg-config && \
    rm -rf /var/lib/apt/lists/*

# Conan + Knuth build helper
RUN pip install --no-cache-dir --upgrade "conan>=2.0" kthbuild

# Knuth Conan config (remotes, profiles). The upstream config2023.zip is
# Conan-1 format; Conan 2 ignores its remotes.txt, so we explicitly add
# the Knuth Artifactory remote after detecting a default profile.
RUN conan config install https://github.com/k-nuth/ci-utils/raw/master/conan/config2023.zip || true; \
    conan profile detect --force && \
    conan remote add --force kth https://packages.kth.cash/api/ && \
    conan remote list && \
    cat /root/.conan2/profiles/default

ARG KTH_VERSION=0.80.0

# Pull the prebuilt Knuth binary into /opt/kth/ (allow building anything missing).
WORKDIR /opt
RUN conan install --requires=kth/${KTH_VERSION} --update --build=missing --deployer=direct_deploy -g VirtualRunEnv \
        -s compiler.cppstd=23 -s build_type=Release \
    && ls -la direct_deploy/ \
    && find direct_deploy -name 'kth' -type f -executable

# ── Runtime stage ───────────────────────────────────────────────────
# trixie is needed for glibc>=2.38 and libstdc++ GLIBCXX_3.4.32 which kth requires.
FROM debian:trixie-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        libstdc++6 \
        libgcc-s1 \
        libatomic1 \
        libgomp1 \
        netcat-openbsd \
        e2fsprogs \
        procps && \
    rm -rf /var/lib/apt/lists/*

# Copy the deployed kth tree (binary + any required .so libs).
# Conan's direct_deploy layout: direct_deploy/kth/{bin,lib,include,...}
COPY --from=build /opt/direct_deploy/ /opt/kth-deploy/

# Surface the binary + libs
RUN set -eux; \
    install -d /usr/local/bin; \
    BIN=$(find /opt/kth-deploy -type f -name 'kth' -executable | head -n1); \
    test -n "$BIN"; \
    ln -sf "$BIN" /usr/local/bin/kth; \
    LIBDIR=$(find /opt/kth-deploy -type d -name 'lib' | head -n1 || true); \
    if [ -n "$LIBDIR" ]; then echo "$LIBDIR" > /etc/ld.so.conf.d/kth.conf; fi; \
    ldconfig; \
    /usr/local/bin/kth --help 2>&1 | head -30 || true

RUN mkdir -p /data
VOLUME /data
EXPOSE 8333

ENTRYPOINT ["kth"]
