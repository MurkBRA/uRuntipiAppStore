# uRuntipiAppStore — UmbrelOS App Store Port for Runtipi

Automated, tested port of **244** non-duplicate apps from [`getumbrel/umbrel-apps`](https://github.com/getumbrel/umbrel-apps) to the [Runtipi](https://runtipi.io) App Store format (`schema_version: 2` YAML + Dynamic Compose JSON v2).

- **Architecture & Engineering Plan**: [`PLANO_PORT_UMBREL_RUNTIPI.md`](./PLANO_PORT_UMBREL_RUNTIPI.md)
- **Official Runtipi & Disabled Apps Blacklist**: [`blacklist.json`](./blacklist.json)

## Summary Statistics

- **Ported Active Apps**: **244**
- **Blacklisted Duplicates / Disabled Apps**: **155**

## Ported Apps Catalog (244 Apps)

| # | App ID | Name | Version | Port | Categories |
| :---: | :--- | :--- | :---: | :---: | :--- |
| 1 | `adventurelog` | **AdventureLog** | `v0.13.1` | `19442` | `utilities, data` |
| 2 | `agent-zero` | **Agent Zero** | `v2.15` | `3015` | `ai` |
| 3 | `agora` | **Agora** | `1.19-alpine` | `12080` | `utilities, data` |
| 4 | `airtrail` | **AirTrail** | `3.14.0` | `3256` | `utilities, data` |
| 5 | `akaunting` | **Akaunting** | `3.1.21` | `8773` | `finance` |
| 6 | `albyhub` | **Alby Hub ✨** | `1.24.6` | `59000` | `finance` |
| 7 | `am-i-exposed` | **am-i.exposed** | `0.43.2` | `4080` | `finance` |
| 8 | `anything-llm` | **AnythingLLM** | `1.19.0` | `3031` | `ai` |
| 9 | `appsmith` | **Appsmith** | `v2.6.0` | `25946` | `development` |
| 10 | `arcane` | **Arcane** | `v2.17.3` | `3552` | `development` |
| 11 | `bark-wallet` | **Bark Wallet** | `0.10.0` | `4004` | `finance` |
| 12 | `bassin` | **Bassin** | `v1.8.11` | `5008` | `finance` |
| 13 | `bentopdf` | **BentoPDF** | `2.8.11` | `8730` | `photography, utilities, data` |
| 14 | `bffless` | **BFFless** | `umbrel` | `5537` | `development` |
| 15 | `bisq2-node` | **Bisq 2 Node** | `2.1.15.0` | `8390` | `finance` |
| 16 | `bitaxe-sentry` | **Bitaxe Sentry** | `v0.8.0` | `7070` | `finance` |
| 17 | `bitbalance` | **bitBalance** | `1.0.18` | `3710` | `finance` |
| 18 | `bitboard` | **bitBoard** | `1.0.2` | `3711` | `finance` |
| 19 | `bitcoin-cash-node` | **Bitcoin Cash Node** | `8bb17f3689d837dbd370ac0d35e4a158ea12b75a` | `3330` | `finance` |
| 20 | `bitcoin-knots` | **Bitcoin Knots** | `1.2.13` | `2105` | `finance` |
| 21 | `bitcoin-regtest-dashboard` | **Bitcoin Regtest Dashboard** | `1.1.0` | `3022` | `finance` |
| 22 | `bitfeed` | **Bitfeed** | `v2.3.4` | `8314` | `finance` |
| 23 | `bitwatch` | **Bitwatch** | `1.8.0` | `3117` | `finance` |
| 24 | `bleskomat-server` | **Bleskomat Server** | `1.3.4` | `25049` | `finance` |
| 25 | `blinko` | **Blinko** | `1.8.9` | `20146` | `utilities, data` |
| 26 | `blockstream-blind-oracle` | **Blockstream Blind Oracle** | `v0.0.36` | `3344` | `finance` |
| 27 | `bluewallet` | **BlueWallet Lightning** | `v1.4.1` | `3008` | `finance` |
| 28 | `bolt12-pay` | **BOLT12 Pay** | `0.3.23` | `8367` | `finance` |
| 29 | `booklore` | **BookLore** | `2.4.0` | `6060` | `books, utilities, data` |
| 30 | `btc-rpc-explorer` | **BTC RPC Explorer** | `3.5.1` | `3002` | `finance` |
| 31 | `btcpay-server` | **BTCPay Server** | `2.4.7` | `3003` | `finance` |
| 32 | `btctracker` | **BTC Tracker** | `0.8.0` | `3947` | `finance` |
| 33 | `calibre-web-automated` | **Calibre-Web Automated** | `v4.0.8` | `24060` | `books, utilities, data` |
| 34 | `campfire` | **Campfire** | `1.5.8` | `8004` | `social` |
| 35 | `canary` | **Canary Wallet** | `1.7.1` | `3005` | `finance` |
| 36 | `cashu-me` | **Cashu.me Wallet** | `0.1.1` | `3194` | `finance` |
| 37 | `chainforensics` | **ChainForensics** | `1.2.0` | `3016` | `finance` |
| 38 | `chantools` | **chantools CLI** | `v0.14.1-umbrel` | `7682` | `finance` |
| 39 | `circuitbreaker` | **Circuit Breaker** | `v0.5.1` | `9235` | `finance` |
| 40 | `cobalt` | **cobalt** | `11.5` | `9009` | `media, music` |
| 41 | `convertx` | **ConvertX** | `0.20.0` | `8386` | `utilities, data` |
| 42 | `copyparty` | **copyparty** | `1.20.26` | `3923` | `books, utilities, data` |
| 43 | `core-lightning` | **Core Lightning** | `26.09` | `2103` | `finance` |
| 44 | `core-lightning-rtl` | **Ride The Lightning (Core Lightning)** | `v0.15.17` | `3100` | `finance` |
| 45 | `datum` | **DATUM** | `v0.5.1` | `21000` | `finance` |
| 46 | `dcrdex` | **Bison Wallet** | `v1.0.5` | `5758` | `finance` |
| 47 | `dcrpulse` | **Decred Pulse** | `1.0.3` | `8735` | `finance` |
| 48 | `deepsea` | **DeepSea Dashboard** | `v2.0.4` | `5300` | `finance` |
| 49 | `docuseal` | **DocuSeal** | `3.3.6` | `8387` | `utilities, data` |
| 50 | `domain-locker` | **Domain Locker** | `0.3.0` | `8839` | `network, security` |
| 51 | `donetick` | **Donetick** | `0.1.86` | `27781` | `utilities, data` |
| 52 | `downtify` | **Downtify** | `3.10.0` | `8789` | `media, music` |
| 53 | `dropgate-server` | **Dropgate Server** | `3.0.13` | `52443` | `utilities, data` |
| 54 | `dtan-server` | **DTAN Server** | `v0.2.0` | `8022` | `network` |
| 55 | `dumbpad` | **DumbPad** | `1.0.4` | `26406` | `utilities, data` |
| 56 | `ee-gateway` | **EE Gateway** | `0.6.5` | `26231` | `network` |
| 57 | `ekko-studio` | **Ekko Studio** | `0.8.20` | `6063` | `ai` |
| 58 | `electrumx` | **ElectrumX** | `1.0.1` | `23042` | `finance` |
| 59 | `element` | **Element** | `1.12.32` | `25597` | `social` |
| 60 | `elements` | **Elements Core** | `v0.0.3` | `3042` | `finance` |
| 61 | `enclosed` | **Enclosed** | `1.16.1` | `8788` | `utilities, data` |
| 62 | `endurain` | **Endurain** | `0.20.2` | `8865` | `social` |
| 63 | `ersatztv-legacy` | **ErsatzTV Legacy** | `26.12.0` | `8409` | `media` |
| 64 | `etherpad` | **Etherpad** | `3.3.16` | `9002` | `utilities, data` |
| 65 | `fedimint-gateway` | **Fedimint Lightning Gateway** | `v0.13.0` | `21335` | `finance` |
| 66 | `fedimintd` | **Fedimint** | `v0.13.0` | `28099` | `finance` |
| 67 | `fizzy` | **Fizzy** | `5f45e54` | `8005` | `social` |
| 68 | `foldergram` | **Foldergram** | `1.3.1` | `4141` | `books, utilities, data` |
| 69 | `formicaio` | **Formicaio** | `0.3.0` | `52100` | `finance` |
| 70 | `fossflow` | **FossFLOW** | `master-b69fc2e` | `8176` | `network` |
| 71 | `frigate` | **Frigate** | `0.18.2` | `5004` | `automation` |
| 72 | `fulcrum` | **Fulcrum** | `1.0.2` | `2109` | `finance` |
| 73 | `gitea-mirror` | **Gitea Mirror** | `3.51.5` | `4322` | `development` |
| 74 | `gitingest` | **Gitingest** | `0.3.1` | `8895` | `development` |
| 75 | `gitlab` | **GitLab** | `19.5.4` | `8929` | `development` |
| 76 | `glasshome` | **GlassHome** | `1.4.5` | `3123` | `automation` |
| 77 | `gobrrr-pool` | **Go Brrr Pool** | `1.2.3` | `21421` | `finance` |
| 78 | `gupt` | **Gupt** | `6.0.0` | `8423` | `social` |
| 79 | `habitica` | **Habitica** | `5.50.6` | `3944` | `utilities, data` |
| 80 | `hashrate-autopilot` | **Hashrate Autopilot** | `1.18.2` | `3018` | `finance` |
| 81 | `helipad` | **Helipad** | `0.2.2` | `2112` | `finance` |
| 82 | `hermes-agent` | **Hermes Agent** | `0.23.1` | `18790` | `ai` |
| 83 | `hermitstash` | **HermitStash** | `1.15.13` | `3081` | `utilities, data` |
| 84 | `holesail-switchboard` | **Holesail Switchboard** | `v2.0.8` | `3160` | `network, security` |
| 85 | `home-assistant-fusion-ui` | **HA-Fusion** | `2024.10.1` | `5023` | `automation` |
| 86 | `homehub` | **HomeHub** | `0.7.0` | `5059` | `books, utilities, data` |
| 87 | `homey` | **Homey** | `13.5.4` | `4859` | `automation` |
| 88 | `hortusfox` | **HortusFox** | `6.4` | `8838` | `utilities, data` |
| 89 | `influxdb` | **InfluxDB** | `1.11.4` | `8888` | `development` |
| 90 | `influxdb2` | **InfluxDB 2** | `2.9.1-alpine` | `8886` | `development` |
| 91 | `invio` | **Invio** | `2.4.1` | `26954` | `finance` |
| 92 | `ipfs-podcasting` | **IPFS Podcasting** | `0.6` | `23718` | `utilities, data` |
| 93 | `jam` | **Jam** | `v0.4.1-clientserver-v0.9.11` | `5002` | `finance` |
| 94 | `jotty` | **Jotty** | `1.29.2` | `8345` | `utilities, data` |
| 95 | `jupyterlab` | **JupyterLab** | `lab-4.6.6` | `8899` | `development` |
| 96 | `just-download` | **Just. Download.** | `v1.0.9` | `3684` | `media` |
| 97 | `kan` | **kan** | `0.7.0` | `8373` | `utilities, data` |
| 98 | `kitchenowl` | **KitchenOwl** | `v0.7.10` | `8474` | `utilities, data` |
| 99 | `kokoro` | **Kokoro** | `0.10.0` | `8877` | `ai` |
| 100 | `komodo` | **Komodo** | `2.3.4` | `9120` | `development` |
| 101 | `krystal-bull` | **Krystal Bull** | `1.9.7` | `21774` | `finance` |
| 102 | `langflow` | **Langflow** | `1.13.2` | `8862` | `ai` |
| 103 | `leafwiki` | **LeafWiki** | `0.14.2` | `8066` | `books, utilities, data` |
| 104 | `librechat` | **LibreChat** | `0.8.7` | `7050` | `ai` |
| 105 | `libreoffice` | **LibreOffice** | `7.6.7` | `5001` | `utilities, data` |
| 106 | `lightning` | **Lightning Node** | `v1.3.3` | `2101` | `finance` |
| 107 | `lightning-terminal` | **Lightning Terminal** | `0.17.7` | `3004` | `finance` |
| 108 | `lightningmate` | **Lightning Mate** | `0.7.7` | `3742` | `finance` |
| 109 | `ln-visualizer` | **LnVisualizer** | `0.0.28` | `5646` | `finance` |
| 110 | `lnbits` | **LNbits** | `1.7.0` | `3007` | `finance` |
| 111 | `lnbits-holesail-proxy` | **LNbits Holesail Proxy** | `v1.0.7` | `3107` | `finance` |
| 112 | `lndg` | **LNDg** | `v1.11.1` | `8889` | `finance` |
| 113 | `lnswitchboard` | **lnSwitchboard** | `0.3.2` | `22121` | `finance` |
| 114 | `localai` | **LocalAI** | `v4.12.1` | `8793` | `ai` |
| 115 | `lunalytics` | **Lunalytics** | `0.10.23` | `8183` | `network` |
| 116 | `mailarchiver` | **Mail Archiver** | `2611.2` | `5006` | `utilities, data` |
| 117 | `mailflow` | **MailFlow** | `4.3.1` | `3395` | `network` |
| 118 | `mainsail` | **Mainsail** | `2.19.0` | `8070` | `utilities, data` |
| 119 | `manifold-fedimint-guardian` | **Manifold Fedimint Guardian** | `cd0f1689df79fc00c9153c9bd9f014113f38c489` | `8483` | `finance` |
| 120 | `mattermost` | **Mattermost** | `12.0.2` | `8765` | `social` |
| 121 | `maybe` | **Maybe** | `0.6.0` | `3063` | `finance` |
| 122 | `mazanoke` | **Mazanoke** | `1.1.7` | `3474` | `photography, utilities, data` |
| 123 | `meshchatx` | **MeshChatX** | `4.10.7` | `8985` | `social` |
| 124 | `miner-sentinel` | **MinerSentinel** | `1.2.0` | `3082` | `finance` |
| 125 | `monetr` | **Monetr** | `1.22.0` | `8379` | `finance` |
| 126 | `morphos` | **Morphos server** | `0.6.0` | `3778` | `photography, utilities, data` |
| 127 | `murmur` | **Murmur** | `0.13.0` | `18793` | `ai` |
| 128 | `music-assistant` | **Music Assistant** | `2.10.9` | `8896` | `media, music` |
| 129 | `myspeed` | **MySpeed** | `1.0.9` | `5216` | `network` |
| 130 | `neko` | **Neko** | `3.2.0` | `3880` | `network` |
| 131 | `netbird` | **NetBird** | `1.27` | `8479` | `network, security` |
| 132 | `networkingtoolbox` | **Networking Toolbox** | `1.6.0` | `3686` | `development` |
| 133 | `nginx-proxy-manager` | **Nginx Proxy Manager** | `2.16.0` | `4498` | `network, security` |
| 134 | `nostr-relay` | **Nostr Relay** | `v1.2.1` | `4848` | `social` |
| 135 | `nostr-vpn` | **Nostr VPN** | `v4.1.20` | `38180` | `network, security` |
| 136 | `nostrudel` | **noStrudel** | `1.1.0` | `3149` | `social` |
| 137 | `notediscovery` | **NoteDiscovery** | `0.34.0` | `8736` | `utilities, data` |
| 138 | `nutstash-wallet` | **Nutstash Wallet** | `0.1.10` | `4173` | `finance` |
| 139 | `obsidian` | **Obsidian** | `1.8.10` | `3435` | `utilities, data` |
| 140 | `octoprint` | **OctoPrint** | `1.11.8` | `5003` | `utilities, data` |
| 141 | `omnitools` | **OmniTools** | `0.7.0` | `22424` | `photography, utilities, data` |
| 142 | `onlyoffice-nextcloud` | **ONLYOFFICE Docs** | `1.0.4` | `3014` | `utilities, data` |
| 143 | `opencode` | **OpenCode** | `1.19.5` | `4096` | `ai` |
| 144 | `opengist` | **Opengist** | `1.15.3` | `6157` | `development` |
| 145 | `openhands` | **OpenHands** | `1.10.0` | `3993` | `ai` |
| 146 | `openreader` | **OpenReader** | `1.30.5-alpine` | `3391` | `ai` |
| 147 | `openresty-manager` | **OpenResty Manager** | `2.4.6` | `34567` | `network, security` |
| 148 | `openthread-border-router` | **OpenThread Border Router** | `0.4.0` | `7586` | `automation` |
| 149 | `ordinals` | **Ordinals** | `0.29.1` | `4000` | `finance` |
| 150 | `originless` | **Originless** | `0.1.0` | `3232` | `utilities, data` |
| 151 | `paperclip` | **Paperclip** | `2026.1106.0` | `8860` | `ai` |
| 152 | `papra` | **Papra** | `26.6.2-rootless` | `23892` | `utilities, data` |
| 153 | `passky-client` | **Passky Client** | `8.1.1` | `5052` | `utilities, data` |
| 154 | `passky-server` | **Passky Server** | `9.0.0` | `5050` | `utilities, data` |
| 155 | `pastefy` | **Pastefy** | `7.1.6` | `9900` | `development` |
| 156 | `pearcircle-seeder` | **PearCircle Seeder** | `1.1.4` | `8731` | `network` |
| 157 | `peerswap` | **PeerSwap** | `7.0.2` | `1984` | `finance` |
| 158 | `perplexica` | **Vane** | `v1.12.2` | `3444` | `ai` |
| 159 | `picoclaw` | **PicoClaw** | `v0.3.1-launcher` | `18800` | `ai` |
| 160 | `picsur` | **Picsur** | `0.5.6` | `8286` | `photography, utilities, data` |
| 161 | `plane` | **Plane** | `alpine3.23` | `8762` | `utilities, data` |
| 162 | `pocketbase` | **PocketBase** | `0.40.6` | `5400` | `development` |
| 163 | `pogolo` | **pogolo** | `v1.x` | `5663` | `finance` |
| 164 | `poznote` | **Poznote** | `6.146.0` | `8389` | `utilities, data` |
| 165 | `public-pool` | **Public Pool** | `1.25.3` | `2019` | `finance` |
| 166 | `public-pool-web` | **Public Pool's Web** | `0.2.0` | `2021` | `finance` |
| 167 | `pyload-ng` | **pyload-ng** | `0.5.0` | `26317` | `utilities, data` |
| 168 | `readeck` | **Readeck** | `0.23.5` | `20887` | `books, utilities, data` |
| 169 | `readur` | **Readur** | `3.1.2` | `19289` | `photography, utilities, data` |
| 170 | `reitti` | **Reitti** | `5.10.0` | `20684` | `photography, utilities, data` |
| 171 | `remmina` | **Remmina** | `1.4.35` | `8764` | `network` |
| 172 | `restreamer` | **Restreamer** | `2.12.0` | `20264` | `utilities, data` |
| 173 | `ride-the-lightning` | **Ride The Lightning** | `v0.15.17` | `3001` | `finance` |
| 174 | `robosats` | **RoboSats** | `v0.8.7-alpha` | `12596` | `finance` |
| 175 | `rotki` | **rotki** | `1.44.2` | `23617` | `finance` |
| 176 | `route96` | **Route96** | `0.7.0` | `25904` | `social` |
| 177 | `rustdesk-server` | **RustDesk Server** | `1.27` | `21080` | `network, security` |
| 178 | `rusty-kaspad` | **Rusty Kaspad** | `v0.4.1` | `4321` | `finance` |
| 179 | `saifa` | **Saifa** | `v1.3.2` | `9989` | `finance` |
| 180 | `samourai-server` | **Samourai Server** | `1.21-alpine` | `3021` | `finance` |
| 181 | `satoshi-dashboard` | **Satoshi Dashboard** | `v1.1.0` | `8410` | `finance` |
| 182 | `satsale` | **SatSale** | `0.1.13` | `22702` | `finance` |
| 183 | `satsbook` | **Satsbook** | `2.1.0` | `3017` | `finance` |
| 184 | `satwatch` | **sat.watch** | `1.1.8` | `3883` | `finance` |
| 185 | `scanservjs` | **scanservjs** | `v3.3.0` | `2903` | `utilities, data` |
| 186 | `seafile` | **Seafile** | `14.0.9` | `8920` | `books, utilities, data` |
| 187 | `seedtool` | **Bitcoin Seed Tool** | `2.3.0` | `8147` | `finance` |
| 188 | `shopstr` | **Shopstr** | `0.7.5` | `30402` | `finance` |
| 189 | `silo` | **Silo** | `RELEASE.2026-11-09T00-00-00Z` | `9130` | `utilities, data` |
| 190 | `skybro` | **SkyBro** | `1.6.2` | `7437` | `network` |
| 191 | `slink` | **Slink** | `1.14.6` | `8811` | `photography, utilities, data` |
| 192 | `snapdrop` | **Snapdrop** | `version-b8b78cc2` | `22763` | `utilities, data` |
| 193 | `snort` | **Snort** | `v0.5.4` | `52027` | `social` |
| 194 | `snowflake` | **Tor Snowflake Proxy** | `v1.6.0` | `3800` | `network, security` |
| 195 | `solidtime` | **Solidtime** | `0.22.1` | `8770` | `utilities, data` |
| 196 | `spacebot` | **Spacebot** | `v0.5.0` | `19898` | `ai` |
| 197 | `sparkkiosk` | **Sparkkiosk** | `v1.0.0` | `21214` | `finance` |
| 198 | `specter-desktop` | **Specter Desktop** | `v2.1.11` | `25441` | `finance` |
| 199 | `sphinx-relay` | **Sphinx Relay** | `v2.5.2` | `3300` | `social` |
| 200 | `sqlitebrowser` | **SQLite Browser** | `3.13.1` | `8887` | `development` |
| 201 | `squeaknode` | **Squeaknode** | `v0.3.4` | `12994` | `social` |
| 202 | `squeakroad` | **Squeak Road** | `v0.1.14` | `18200` | `finance` |
| 203 | `stash` | **Stash** | `1.0.1` | `5173` | `ai` |
| 204 | `strix` | **Strix** | `2.2.0` | `24438` | `automation` |
| 205 | `super-productivity` | **Super Productivity** | `20.0.0` | `8020` | `utilities, data` |
| 206 | `sure` | **Sure** | `0.7.6` | `3064` | `finance` |
| 207 | `suredbits-wallet` | **Suredbits Wallet** | `1.9.7` | `3020` | `finance` |
| 208 | `sv2-ui` | **Stratum V2 UI** | `0.8.2` | `8077` | `finance` |
| 209 | `swingmusic` | **Swing Music** | `v3.0.0` | `1970` | `media, music` |
| 210 | `synapse` | **Synapse** | `1.164.2` | `20060` | `social` |
| 211 | `syslog-ng` | **Syslog-ng** | `0.17.1` | `5142` | `network` |
| 212 | `tdex` | **TDEX Provider** | `2.6.4-alpine` | `9094` | `finance` |
| 213 | `technitium-dns` | **Technitium DNS Server** | `15.6.2` | `5380` | `network, security` |
| 214 | `telegrapho` | **Telegrapho** | `1.0.1` | `3712` | `network` |
| 215 | `termix` | **Termix** | `2.9.2` | `6444` | `development` |
| 216 | `thinkdashboard` | **ThinkDashboard** | `v0.7.6` | `8229` | `utilities, data` |
| 217 | `threema` | **Threema Web** | `2.6.5` | `8855` | `utilities, data` |
| 218 | `thunderhub` | **ThunderHub** | `0.19.1` | `24188` | `finance` |
| 219 | `torbrowser` | **Tor Browser** | `15.0.17` | `5832` | `network` |
| 220 | `torq` | **Torq** | `2.2.9` | `7028` | `finance` |
| 221 | `toshi-moto` | **Toshi Moto** | `1.37.3` | `8021` | `finance` |
| 222 | `transmute` | **Transmute** | `2.1.1` | `3313` | `utilities, data` |
| 223 | `trip` | **Trip** | `1.50.1` | `8980` | `utilities, data` |
| 224 | `twenty` | **Twenty** | `2.57.1` | `2020` | `utilities, data` |
| 225 | `urbit` | **Urbit** | `v4.6` | `21955` | `network` |
| 226 | `urbit-bitcoin-connector` | **Urbit Bitcoin Connector** | `latest` | `9090` | `finance` |
| 227 | `usocial` | **usocial** | `v0.1.5-buster` | `8448` | `social` |
| 228 | `valorgrid` | **ValorGrid** | `3.36.3` | `1325` | `finance` |
| 229 | `vert` | **VERT** | `257bcb3` | `3884` | `utilities, data` |
| 230 | `wanderer` | **Wanderer** | `0.21.2` | `3111` | `utilities, data` |
| 231 | `wavelog` | **Wavelog** | `3.2.5` | `22784` | `social` |
| 232 | `wealthfolio` | **Wealthfolio** | `3.12.0` | `19334` | `finance` |
| 233 | `webcheck` | **WebCheck** | `2.4.0` | `3093` | `network, security` |
| 234 | `wger` | **wger** | `alpine3.22` | `8450` | `utilities, data` |
| 235 | `wingfit` | **Wingfit** | `5.3.1` | `8950` | `utilities, data` |
| 236 | `woofbot` | **WoofBot (without Lightning)** | `0.9.8` | `22182` | `finance` |
| 237 | `woofbot-lnd` | **WoofBot (LND)** | `v0.9.8` | `21412` | `finance` |
| 238 | `yamtrack` | **Yamtrack** | `0.26.3` | `8742` | `media` |
| 239 | `yucca` | **Yucca** | `0.13.4` | `9910` | `automation` |
| 240 | `yuvomi` | **Yuvomi** | `2.86.0` | `26765` | `utilities, data` |
| 241 | `zabbix` | **Zabbix** | `8.0.0` | `10052` | `network, security` |
| 242 | `zen` | **Zen** | `2.0.0` | `8894` | `utilities, data` |
| 243 | `zeronote` | **ZeroNote** | `1.0.12` | `18817` | `utilities, data` |
| 244 | `zoraxy` | **Zoraxy** | `v3.3.4` | `8400` | `network, security` |
