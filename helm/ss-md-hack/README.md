# SS MD Hack Helm Chart

This Helm chart deploys the Sensible Soccer ROM Editor with multi-container support, including PostgreSQL and Redis dependencies.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.2.0+
- PV provisioner support in the underlying infrastructure (for persistent storage)
- ReadWriteMany (RWX) capable storage class for ROM storage

## Dependencies

- PostgreSQL 15+ (for persistent audit logging)
- Redis 7+ (for ephemeral session cache)

## Installing the Chart

### 1. Add the Helm repository (if published)

```bash
helm repo add ss-md-hack https://your-repo.github.io/charts
helm repo update
```

### 2. Install with default values

```bash
helm install ssmdhack ss-md-hack/ss-md-hack
```

### 3. Install with custom values

```bash
# Create a custom values file
cat > my-values.yaml <<EOF
replicaCount: 5

admin:
  username: admin
  passwordHash: "\$2b\$12\$YourBcryptHashHere"

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: ssmdhack.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ssmdhack-tls
      hosts:
        - ssmdhack.yourdomain.com

postgresql:
  auth:
    password: "secure-password-here"
EOF

# Install with custom values
helm install ssmdhack ss-md-hack/ss-md-hack -f my-values.yaml
```

## Configuration

### Important Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of app replicas | `3` |
| `admin.username` | Admin username | `admin` |
| `admin.passwordHash` | Bcrypt hashed admin password | (required) |
| `config.sessionTtl` | Session TTL in seconds | `1800` |
| `config.romRetentionDays` | ROM retention period | `30` |
| `persistence.enabled` | Enable ROM storage | `true` |
| `persistence.storageClass` | Storage class for ROMs | `standard-rwx` |
| `persistence.size` | ROM storage size | `50Gi` |

### Generating Admin Password Hash

```bash
python3 -c "import bcrypt; print(bcrypt.hashpw(b'your-password', bcrypt.gensalt()).decode())"
```

### Storage Requirements

The chart requires a storage class that supports **ReadWriteMany (RWX)** access mode for ROM storage. This allows multiple pods to read the same ROM files simultaneously.

Popular options:
- NFS
- CephFS
- GlusterFS
- AWS EFS
- Azure Files

## Upgrading

```bash
helm upgrade ssmdhack ss-md-hack/ss-md-hack -f my-values.yaml
```

## Uninstalling

```bash
helm uninstall ssmdhack
```

**Note:** This will not delete PVCs. To delete all data:

```bash
helm uninstall ssmdhack
kubectl delete pvc -l app.kubernetes.io/name=ss-md-hack
```

## Monitoring

### Prometheus Metrics

Enable ServiceMonitor for Prometheus Operator:

```yaml
serviceMonitor:
  enabled: true
  namespace: monitoring
```

### Available Metrics

- `ss_requests_total` - Total HTTP requests
- `ss_active_sessions` - Current active sessions
- `ss_rom_storage_bytes` - ROM storage usage
- `ss_request_duration_seconds` - Request latency

## Admin Interface

Access the admin panel at `/#/admin` after logging in with the configured credentials.

## Troubleshooting

### Check pod status
```bash
kubectl get pods -l app.kubernetes.io/name=ss-md-hack
```

### View logs
```bash
kubectl logs -l app.kubernetes.io/name=ss-md-hack -f
```

### Check PVC status
```bash
kubectl get pvc -l app.kubernetes.io/name=ss-md-hack
```

### Database connection issues
Ensure PostgreSQL is running:
```bash
kubectl get pods -l app.kubernetes.io/name=postgresql
```

## Development

### Testing locally with kind

```bash
# Create cluster
kind create cluster

# Install chart
helm install ssmdhack ./helm/ss-md-hack \
  --set persistence.storageClass=standard \
  --set postgresql.primary.persistence.storageClass=standard

# Port forward
kubectl port-forward svc/ssmdhack 8080:80
```

## License

[Your License Here]
