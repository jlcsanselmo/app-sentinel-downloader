# 1. A IMAGEM BASE 
FROM python:3.11-slim

# 2. VARIÁVEIS DE AMBIENTE 
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. DEPENDÊNCIAS DO SISTEMA (O MOTOR GEOESPACIAL) 
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 4. PASTA DE TRABALHO 
WORKDIR /app

# 5. INSTALAR AS BIBLIOTECAS PYTHON 
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. INSTALAR AS BIBLIOTECAS PYTHON 
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt