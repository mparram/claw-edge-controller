FROM registry.access.redhat.com/ubi9/nodejs-20:1-44.1714669803
USER root
WORKDIR /app
RUN chown -R 1001:0 /app
COPY package.json /app
RUN npm install -g npm
RUN npm install
COPY . /app
RUN dnf install systemd-udev -y
RUN dnf upgrade -y
RUN dnf clean all
USER 1001
EXPOSE 8080
CMD npm start