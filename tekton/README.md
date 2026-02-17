# Tekton CI/CD Pipeline

This directory contains Tekton pipeline manifests for building and pushing the ss-md-hack container image to the local registry at `192.168.1.9:32000`.

## Overview

The pipeline has two stages:

1. **git-clone** - Clones the repository and checks out the specified revision
2. **buildah-insecure** - Builds the multi-stage Dockerfile (frontend + backend) and pushes to the insecure HTTP registry

## Namespace

All Tekton resources need to live in the same namespace. Use `-n <namespace>` on every `kubectl` command to control where they go:

```bash
# Using a dedicated namespace
kubectl create namespace tekton-builds
kubectl apply -f tekton/resources/workspace-pvc.yaml -n tekton-builds
kubectl apply -f tekton/tasks/git-clone.yaml -n tekton-builds
kubectl apply -f tekton/tasks/buildah.yaml -n tekton-builds
kubectl apply -f tekton/pipelines/build-and-push.yaml -n tekton-builds
```

Alternatively, set your default namespace so you don't need `-n` every time:

```bash
kubectl config set-context --current --namespace=tekton-builds
```

The PVC, Tasks, Pipeline, and PipelineRuns must all be in the same namespace — Tekton does not resolve cross-namespace references.

## Initial Setup

```bash
# 1. Create namespace (optional, or use default)
kubectl create namespace tekton-builds

# 2. Create workspace PVC
kubectl apply -f tekton/resources/workspace-pvc.yaml -n tekton-builds

# 3. Install tasks
kubectl apply -f tekton/tasks/git-clone.yaml -n tekton-builds
kubectl apply -f tekton/tasks/buildah.yaml -n tekton-builds

# 4. Install pipeline
kubectl apply -f tekton/pipelines/build-and-push.yaml -n tekton-builds
```

## Triggering a Build

Use `kubectl create` (not `apply`) because the PipelineRun uses `generateName` to create a unique name each time:

```bash
# Build latest from main
kubectl create -f tekton/pipelineruns/build-and-push-run.yaml -n tekton-builds

# Build a specific branch or tag
kubectl create -f tekton/pipelineruns/build-and-push-run.yaml -n tekton-builds \
  # (edit the file first, or override inline — see below)
```

To override parameters without editing the file, create the PipelineRun inline:

```bash
# Build a specific branch with a specific tag
cat <<'EOF' | kubectl create -n tekton-builds -f -
apiVersion: tekton.dev/v1
kind: PipelineRun
metadata:
  generateName: build-ss-md-hack-
spec:
  pipelineRef:
    name: build-and-push
  params:
    - name: revision
      value: feature/my-branch
    - name: image-tag
      value: feature-test
  workspaces:
    - name: shared-workspace
      persistentVolumeClaim:
        claimName: tekton-workspace-pvc
EOF
```

## Monitoring a Build

```bash
# List pipeline runs
kubectl get pipelineruns -n tekton-builds

# Follow logs of the latest run (requires tkn CLI)
tkn pipelinerun logs -f -L -n tekton-builds

# Follow logs of a specific run
tkn pipelinerun logs build-ss-md-hack-abc123 -f -n tekton-builds

# Or without tkn, find the pod and read its logs
kubectl get pods -n tekton-builds
kubectl logs <pod-name> -n tekton-builds --all-containers -f
```

## Verifying the Image

```bash
# Check the registry catalogue
curl http://192.168.1.9:32000/v2/_catalog

# List tags for the image
curl http://192.168.1.9:32000/v2/ss-md-hack/tags/list
```

## Deploying

```bash
helm upgrade --install ss-md-hack ./helm/ss-md-hack \
  --set image.tag=latest \
  -n <app-namespace>
```
