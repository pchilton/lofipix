# Nginx

nginx provides the reverse proxy for the API server and storage.

- Ensure that the API server is running
- Ensure that SeaweedFS has been configured

## Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name oceania.lofipix.app;

    # TLS Configuration 
    ssl_certificate /etc/letsencrypt/live/oceania.lofipix.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/oceania.lofipix.app/privkey.pem;

    # Route 1: Direct standard API queries down to your Bun/Hono Server
    location /api/ {
        proxy_pass http://127.0.0.1:3000; # Assuming Hono matches this port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Route 2: Intercept and pass bucket requests through to SeaweedFS S3 API
    location /storage-oceania-lofipix/ {
        # Proxy straight to the SeaweedFS S3 component daemon port
        proxy_pass http://127.0.0.1:8333; 
        
        # Enforce exact standard streaming parameters for raw binary object payloads
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable standard proxy buffering so massive task scripts or zip payloads 
        # stream straight into the background worker memory without disk cache latency
        proxy_buffering off;
        proxy_request_buffering off;
        
        # Lift standard upload boundaries so large payload packages pass cleanly
        client_max_body_size 500M;
    }
}
```