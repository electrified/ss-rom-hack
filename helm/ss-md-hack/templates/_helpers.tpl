{{/*
Expand the name of the chart.
*/}}
{{- define "ss-md-hack.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "ss-md-hack.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "ss-md-hack.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "ss-md-hack.labels" -}}
helm.sh/chart: {{ include "ss-md-hack.chart" . }}
{{ include "ss-md-hack.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "ss-md-hack.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ss-md-hack.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "ss-md-hack.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "ss-md-hack.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Database connection URL
*/}}
{{- define "ss-md-hack.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "postgresql+asyncpg://%s:%s@%s-postgresql:5432/%s" 
  .Values.postgresql.auth.username 
  .Values.postgresql.auth.password 
  .Release.Name 
  .Values.postgresql.auth.database }}
{{- else }}
{{- required "A valid .Values.config.databaseUrl entry required!" .Values.config.databaseUrl }}
{{- end }}
{{- end }}

{{/*
Redis connection URL
*/}}
{{- define "ss-md-hack.redisUrl" -}}
{{- if .Values.redis.enabled }}
{{- printf "redis://%s-redis-master:6379/0" .Release.Name }}
{{- else }}
{{- required "A valid .Values.config.redisUrl entry required!" .Values.config.redisUrl }}
{{- end }}
{{- end }}
