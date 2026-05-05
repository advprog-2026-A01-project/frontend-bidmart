# Docker Evidence: Frontend

## Purpose

This document records Docker evidence for `frontend-bidmart`.

The frontend is built with Vite and served through Nginx.

## Build Check

~~~bash
./scripts/verify-docker-contract.sh
~~~

## Runtime Port

~~~text
80 inside container
5173 on host when mapped through Docker Compose
~~~

## Gateway Proxy

Nginx proxies API requests to the API Gateway container:

~~~nginx
location /api/ {
    proxy_pass http://bidmart-api-gateway:8080;
}
~~~

## Architecture Rule

The frontend must not call internal microservices directly.
It should communicate only with the API Gateway.
