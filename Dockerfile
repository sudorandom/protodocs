# ==============================================================================
# Dockerfile for ProtoDocs
#
# Build:
#   docker build -t protodocs .
#
# Run:
#   docker run -d -p 8080:80 protodocs
#
# Mounting a custom .binpb file at runtime:
#   docker run -d -p 8080:80 \
#     -v $(pwd)/my-descriptors.binpb:/usr/share/nginx/html/custom.binpb \
#     protodocs
#   Then open: http://localhost:8080/?descriptors=/custom.binpb
# ==============================================================================

FROM nginx:alpine

# Copy the locally built dist folder into the Nginx container
COPY dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
