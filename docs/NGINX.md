## Bucket Location

Using a bucket name of `lofipix-development`, so that location matching can be used on the VPS host.

```nginx
location /lofipix-development/ {
    # 1. Handle CORS Preflight Requests (OPTIONS method)
    if ($request_method = 'OPTIONS') {
        # Check if the origin matches localhost or any lofipix.app subdomain
        if ($http_origin ~* (https?://(localhost(:\d+)?|.*\.lofipix\.app))) {
            add_header 'Access-Control-Allow-Origin' "$http_origin" always;
            add_header 'Access-Control-Allow-Methods' 'GET, PUT, POST, DELETE, HEAD, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' '*' always;
            add_header 'Access-Control-Expose-Headers' 'ETag, Content-Length, Connection' always;
            add_header 'Access-Control-Max-Age' 3600 always;
        }
        # Return immediate 204 response for preflight without passing to MinIO
        return 204;
    }

    # 2. Handle actual data routing (GET, PUT, etc.)
    proxy_pass http://127.0.0.1:9000;
    
    # Inject CORS headers on standard successful data transfers
    if ($http_origin ~* (https?://(localhost(:\d+)?|.*\.lofipix\.app))) {
        add_header 'Access-Control-Allow-Origin' "$http_origin" always;
        add_header 'Access-Control-Allow-Methods' 'GET, PUT, POST, DELETE, HEAD, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' '*' always;
        add_header 'Access-Control-Expose-Headers' 'ETag, Content-Length, Connection' always;
    }

    # Standard S3 signature headers
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    client_max_body_size 0;
    proxy_buffering off;
    proxy_http_version 1.1;
}
```