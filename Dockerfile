FROM node:22-bookworm-slim

ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/build-tools/35.0.0:$PATH

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl unzip openjdk-17-jre-headless \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /opt/android-sdk/cmdline-tools /tmp/android-cli \
 && curl -fsSL -o /tmp/android-cli.zip https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip \
 && unzip -q /tmp/android-cli.zip -d /tmp/android-cli \
 && mkdir -p /opt/android-sdk/cmdline-tools/latest \
 && mv /tmp/android-cli/cmdline-tools/* /opt/android-sdk/cmdline-tools/latest/ \
 && rm -rf /tmp/android-cli /tmp/android-cli.zip \
 && yes | sdkmanager --licenses >/dev/null || true \
 && sdkmanager "platform-tools" "build-tools;35.0.0" \
 && rm -rf /root/.android /root/.cache

WORKDIR /app
COPY package.json ./
COPY server.mjs ./
COPY public ./public
ENV PORT=8080 DATA_DIR=/data ANDROID_HOST=android ANDROID_PORT=5555
EXPOSE 8080
CMD ["node","server.mjs"]
