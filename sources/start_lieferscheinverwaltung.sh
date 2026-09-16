#!/bin/bash

echo Starte Lieferscheinverwaltung

echo Check ob Docker aktiv

if systemctl is-active --quiet docker; then
    echo Starte n8n
    docker start n8n
else
    echo Starte Docker
    sudo systemctl start docker
    echo Starte n8n
    docker start n8n
fi

#npm update whatsapp-web.js

#node index.js