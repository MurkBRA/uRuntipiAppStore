# uRuntipiAppStore — UmbrelOS App Store Port for Runtipi

Automated, tested port of **249** non-duplicate apps from [`getumbrel/umbrel-apps`](https://github.com/getumbrel/umbrel-apps) to the [Runtipi](https://runtipi.io) App Store format (`schema_version: 2` YAML + Dynamic Compose JSON v2).

- **Architecture & Engineering Plan**: [`PLANO_PORT_UMBREL_RUNTIPI.md`](./PLANO_PORT_UMBREL_RUNTIPI.md)
- **Official Runtipi & Disabled Apps Blacklist**: [`blacklist.json`](./blacklist.json)

## Summary Statistics

- **Ported Active Apps**: **249**
- **Blacklisted Duplicates / Disabled Apps**: **147**

## Ported Apps Catalog (249 Apps)

| # | App ID | Name | Version | Port | Categories |
| :---: | :--- | :--- | :---: | :---: | :--- |
| 1 | `adventurelog` | **AdventureLog** | `v0.13.0` | `19442` | `utilities, data` |
| 2 | `agent-zero` | **Agent Zero** | `v2.14` | `3015` | `ai` |
| 3 | `agora` | **Agora** | `1.19-alpine` | `12080` | `utilities, data` |
| 4 | `airtrail` | **AirTrail** | `3.13.0` | `3256` | `utilities, data` |
| 5 | `akaunting` | **Akaunting** | `3.1.21` | `8773` | `finance` |
| 6 | `albyhub` | **Alby Hub ✨** | `1.24.3` | `59000` | `finance` |
| 7 | `am-i-exposed` | **am-i.exposed** | `0.43.2` | `4080` | `finance` |
| 8 | `anything-llm` | **AnythingLLM** | `1.18.0` | `3031` | `ai` |
| 9 | `appsmith` | **Appsmith** | `v2.5.1` | `25946` | `development` |
| 10 | `arcane` | **Arcane** | `2.17.0` | `3552` | `development` |
| 11 | `bark-wallet` | **Bark Wallet** | `0.9.0` | `4004` | `finance` |
| 12 | `bassin` | **Bassin** | `v1.8.11` | `5008` | `finance` |
| 13 | `bentopdf` | **BentoPDF** | `2.8.10` | `8730` | `photography, utilities, data` |
| 14 | `bffless` | **BFFless** | `umbrel` | `5537` | `development` |
| 15 | `bisq2-node` | **Bisq 2 Node** | `2.1.14.0` | `8390` | `finance` |
| 16 | `bitaxe-sentry` | **Bitaxe Sentry** | `v0.8.0` | `7070` | `finance` |
| 17 | `bitbalance` | **bitBalance** | `1.0.18` | `3710` | `finance` |
| 18 | `bitboard` | **bitBoard** | `1.0.2` | `3711` | `finance` |
| 19 | `bitcoin-cash-node` | **Bitcoin Cash Node** | `8bb17f3689d837dbd370ac0d35e4a158ea12b75a` | `3330` | `finance` |
| 20 | `bitcoin-knots` | **Bitcoin Knots** | `1.2.13` | `2105` | `finance` |
| 21 | `bitcoin-regtest-dashboard` | **Bitcoin Regtest Dashboard** | `1.1.0` | `3022` | `finance` |
| 22 | `bitfeed` | **Bitfeed** | `v2.3.4` | `8314` | `finance` |
| 23 | `bitwatch` | **Bitwatch** | `1.8.0` | `3117` | `finance` |
| 24 | `bleskomat-server` | **Bleskomat Server** | `1.3.4` | `25049` | `finance` |
| 25 | `blinko` | **Blinko** | `1.8.8` | `20146` | `utilities, data` |
| 26 | `blockstream-blind-oracle` | **Blockstream Blind Oracle** | `v0.0.36` | `3344` | `finance` |
| 27 | `bluewallet` | **BlueWallet Lightning** | `v1.4.1` | `3008` | `finance` |
| 28 | `bolt12-pay` | **BOLT12 Pay** | `0.3.15` | `8367` | `finance` |
| 29 | `booklore` | **BookLore** | `2.4.0` | `6060` | `books, utilities, data` |
| 30 | `btc-rpc-explorer` | **BTC RPC Explorer** | `3.5.1` | `3002` | `finance` |
| 31 | `btcpay-server` | **BTCPay Server** | `2.4.5` | `3003` | `finance` |
| 32 | `btctracker` | **BTC Tracker** | `0.8.0` | `3947` | `finance` |
| 33 | `campfire` | **Campfire** | `1.5.6` | `8004` | `social` |
| 34 | `canary` | **Canary Wallet** | `1.7.0` | `3005` | `finance` |
| 35 | `cashu-me` | **Cashu.me Wallet** | `0.1.1` | `3194` | `finance` |
| 36 | `chainforensics` | **ChainForensics** | `1.2.0` | `3016` | `finance` |
| 37 | `chantools` | **chantools CLI** | `v0.14.1-umbrel` | `7682` | `finance` |
| 38 | `circuitbreaker` | **Circuit Breaker** | `v0.5.1` | `9235` | `finance` |
| 39 | `cobalt` | **cobalt** | `11.5` | `9009` | `media, music` |
| 40 | `convertx` | **ConvertX** | `0.19.0` | `8386` | `utilities, data` |
| 41 | `copyparty` | **copyparty** | `1.20.26` | `3923` | `books, utilities, data` |
| 42 | `core-lightning` | **Core Lightning** | `26.09` | `2103` | `finance` |
| 43 | `core-lightning-rtl` | **Ride The Lightning (Core Lightning)** | `v0.15.15` | `3100` | `finance` |
| 44 | `datum` | **DATUM** | `v1.14` | `21000` | `finance` |
| 45 | `dcrdex` | **Bison Wallet** | `v1.0.5` | `5758` | `finance` |
| 46 | `dcrpulse` | **Decred Pulse** | `1.0.3` | `8735` | `finance` |
| 47 | `deepsea` | **DeepSea Dashboard** | `v2.0.4` | `5300` | `finance` |
| 48 | `docuseal` | **DocuSeal** | `3.3.3` | `8387` | `utilities, data` |
| 49 | `domain-locker` | **Domain Locker** | `0.3.0` | `8839` | `network, security` |
| 50 | `donetick` | **Donetick** | `0.1.83` | `27781` | `utilities, data` |
| 51 | `downtify` | **Downtify** | `3.7.0` | `8789` | `media, music` |
| 52 | `dropgate-server` | **Dropgate Server** | `3.0.13` | `52443` | `utilities, data` |
| 53 | `dtan-server` | **DTAN Server** | `v0.2.0` | `8022` | `network` |
| 54 | `dumbpad` | **DumbPad** | `1.0.4` | `26406` | `utilities, data` |
| 55 | `ee-gateway` | **EE Gateway** | `0.6.5` | `26231` | `network` |
| 56 | `ekko-studio` | **Ekko Studio** | `0.7.38` | `6063` | `ai` |
| 57 | `electrumx` | **ElectrumX** | `1.0.0` | `23042` | `finance` |
| 58 | `element` | **Element** | `1.12.32` | `25597` | `social` |
| 59 | `elements` | **Elements Core** | `v0.0.3` | `3042` | `finance` |
| 60 | `enclosed` | **Enclosed** | `1.16.0-rootless` | `8788` | `utilities, data` |
| 61 | `endurain` | **Endurain** | `0.20.1` | `8865` | `social` |
| 62 | `ersatztv-legacy` | **ErsatzTV Legacy** | `26.11.3` | `8409` | `media` |
| 63 | `etherpad` | **Etherpad** | `3.3.9` | `9002` | `utilities, data` |
| 64 | `fedimint-gateway` | **Fedimint Lightning Gateway** | `v0.12.2` | `21335` | `finance` |
| 65 | `fedimintd` | **Fedimint** | `v0.12.2` | `28099` | `finance` |
| 66 | `fizzy` | **Fizzy** | `5f45e54` | `8005` | `social` |
| 67 | `foldergram` | **Foldergram** | `1.2.2` | `4141` | `books, utilities, data` |
| 68 | `formicaio` | **Formicaio** | `0.3.0` | `52100` | `finance` |
| 69 | `fossflow` | **FossFLOW** | `master-b69fc2e` | `8176` | `network` |
| 70 | `frigate` | **Frigate** | `0.18.2` | `5004` | `automation` |
| 71 | `fulcrum` | **Fulcrum** | `1.0.1` | `2109` | `finance` |
| 72 | `gitea-mirror` | **Gitea Mirror** | `3.43.0` | `4322` | `development` |
| 73 | `gitingest` | **Gitingest** | `0.3.1` | `8895` | `development` |
| 74 | `gitlab` | **GitLab** | `19.5.1` | `8929` | `development` |
| 75 | `glasshome` | **GlassHome** | `1.4.5` | `3123` | `automation` |
| 76 | `gobrrr-pool` | **Go Brrr Pool** | `v1.2.1` | `21421` | `finance` |
| 77 | `gupt` | **Gupt** | `5.1.0` | `8423` | `social` |
| 78 | `habitica` | **Habitica** | `5.50.6` | `3944` | `utilities, data` |
| 79 | `hashrate-autopilot` | **Hashrate Autopilot** | `1.18.2` | `3018` | `finance` |
| 80 | `helipad` | **Helipad** | `0.2.2` | `2112` | `finance` |
| 81 | `hermes-agent` | **Hermes Agent** | `0.22.4` | `18790` | `ai` |
| 82 | `hermitstash` | **HermitStash** | `1.15.9` | `3081` | `utilities, data` |
| 83 | `holesail-switchboard` | **Holesail Switchboard** | `v2.0.8` | `3160` | `network, security` |
| 84 | `home-assistant-fusion-ui` | **HA-Fusion** | `2024.10.1` | `5023` | `automation` |
| 85 | `homehub` | **HomeHub** | `0.4.1` | `5059` | `books, utilities, data` |
| 86 | `homey` | **Homey** | `13.5.3` | `4859` | `automation` |
| 87 | `hortusfox` | **HortusFox** | `6.4` | `8838` | `utilities, data` |
| 88 | `influxdb` | **InfluxDB** | `1.11.4` | `8888` | `development` |
| 89 | `influxdb2` | **InfluxDB 2** | `2.9.1-alpine` | `8886` | `development` |
| 90 | `invio` | **Invio** | `v2.2.0` | `26954` | `finance` |
| 91 | `ipfs-podcasting` | **IPFS Podcasting** | `0.6` | `23718` | `utilities, data` |
| 92 | `jam` | **Jam** | `v0.4.1-clientserver-v0.9.11` | `5002` | `finance` |
| 93 | `joinstr` | **Joinstr** | `0.1.2` | `5500` | `finance` |
| 94 | `jotty` | **Jotty** | `1.28.0` | `8345` | `utilities, data` |
| 95 | `jupyterlab` | **JupyterLab** | `lab-4.6.4` | `8899` | `development` |
| 96 | `just-download` | **Just. Download.** | `v1.0.9` | `3684` | `media` |
| 97 | `kan` | **kan** | `0.6.0` | `8373` | `utilities, data` |
| 98 | `kitchenowl` | **KitchenOwl** | `v0.7.10` | `8474` | `utilities, data` |
| 99 | `kokoro` | **Kokoro** | `0.9.0` | `8877` | `ai` |
| 100 | `komodo` | **Komodo** | `2.3.3` | `9120` | `development` |
| 101 | `krystal-bull` | **Krystal Bull** | `1.9.7` | `21774` | `finance` |
| 102 | `l-town` | **L-Town** | `20260621` | `30300` | `social` |
| 103 | `langflow` | **Langflow** | `1.12.7` | `8862` | `ai` |
| 104 | `leafwiki` | **LeafWiki** | `0.14.1` | `8066` | `books, utilities, data` |
| 105 | `libre-relay` | **Libre Relay** | `libre-relay-v28.0-2` | `2108` | `finance` |
| 106 | `librechat` | **LibreChat** | `0.8.7` | `7050` | `ai` |
| 107 | `libreoffice` | **LibreOffice** | `7.6.7` | `5001` | `utilities, data` |
| 108 | `lightning` | **Lightning Node** | `v1.3.2` | `2101` | `finance` |
| 109 | `lightning-terminal` | **Lightning Terminal** | `0.17.7` | `3004` | `finance` |
| 110 | `lightningmate` | **Lightning Mate** | `0.7.7` | `3742` | `finance` |
| 111 | `ln-visualizer` | **LnVisualizer** | `0.0.28` | `5646` | `finance` |
| 112 | `lnbits` | **LNbits** | `1.6.2` | `3007` | `finance` |
| 113 | `lnbits-holesail-proxy` | **LNbits Holesail Proxy** | `v1.0.7` | `3107` | `finance` |
| 114 | `lndg` | **LNDg** | `v1.11.1` | `8889` | `finance` |
| 115 | `lnswitchboard` | **lnSwitchboard** | `0.3.2` | `22121` | `finance` |
| 116 | `localai` | **LocalAI** | `v4.11.0` | `8793` | `ai` |
| 117 | `lunalytics` | **Lunalytics** | `0.10.23` | `8183` | `network` |
| 118 | `mailarchiver` | **Mail Archiver** | `2610.1` | `5006` | `utilities, data` |
| 119 | `mailflow` | **MailFlow** | `4.0.3` | `3395` | `network` |
| 120 | `mainsail` | **Mainsail** | `2.19.0` | `8070` | `utilities, data` |
| 121 | `manifold-fedimint-guardian` | **Manifold Fedimint Guardian** | `61d28d774e72f27d25e41489e33126ae3184e170` | `8483` | `finance` |
| 122 | `mattermost` | **Mattermost** | `12.0.0` | `8765` | `social` |
| 123 | `maybe` | **Maybe** | `0.6.0` | `3063` | `finance` |
| 124 | `mazanoke` | **Mazanoke** | `1.1.7` | `3474` | `photography, utilities, data` |
| 125 | `meshchatx` | **MeshChatX** | `4.10.7` | `8985` | `social` |
| 126 | `miner-sentinel` | **MinerSentinel** | `1.2.0` | `3082` | `finance` |
| 127 | `monetr` | **Monetr** | `1.19.0` | `8379` | `finance` |
| 128 | `morphos` | **Morphos server** | `0.6.0` | `3778` | `photography, utilities, data` |
| 129 | `murmur` | **Murmur** | `0.7.0` | `18793` | `ai` |
| 130 | `music-assistant` | **Music Assistant** | `2.10.7` | `8896` | `media, music` |
| 131 | `myspeed` | **MySpeed** | `1.0.9` | `5216` | `network` |
| 132 | `neko` | **Neko** | `3.2.0` | `3880` | `network` |
| 133 | `netbird` | **NetBird** | `1.27` | `8479` | `network, security` |
| 134 | `networkingtoolbox` | **Networking Toolbox** | `1.6.0` | `3686` | `development` |
| 135 | `nginx-proxy-manager` | **Nginx Proxy Manager** | `2.16.0` | `4498` | `network, security` |
| 136 | `nostr-relay` | **Nostr Relay** | `v1.1.0` | `4848` | `social` |
| 137 | `nostr-vpn` | **Nostr VPN** | `v4.1.18` | `38180` | `network, security` |
| 138 | `nostrudel` | **noStrudel** | `1.1.0` | `3149` | `social` |
| 139 | `notediscovery` | **NoteDiscovery** | `0.32.1` | `8736` | `utilities, data` |
| 140 | `nutstash-wallet` | **Nutstash Wallet** | `0.1.10` | `4173` | `finance` |
| 141 | `obsidian` | **Obsidian** | `1.8.10` | `3435` | `utilities, data` |
| 142 | `octoprint` | **OctoPrint** | `1.11.8` | `5003` | `utilities, data` |
| 143 | `omnitools` | **OmniTools** | `0.7.0` | `22424` | `photography, utilities, data` |
| 144 | `onlyoffice-nextcloud` | **ONLYOFFICE Docs** | `1.0.4` | `3014` | `utilities, data` |
| 145 | `opencode` | **OpenCode** | `1.19.3` | `4096` | `ai` |
| 146 | `opengist` | **Opengist** | `1.15.3` | `6157` | `development` |
| 147 | `openhands` | **OpenHands** | `1.10.0` | `3993` | `ai` |
| 148 | `openreader` | **OpenReader** | `1.30.5-alpine` | `3391` | `ai` |
| 149 | `openresty-manager` | **OpenResty Manager** | `2.4.6` | `34567` | `network, security` |
| 150 | `openthread-border-router` | **OpenThread Border Router** | `0.4.0` | `7586` | `automation` |
| 151 | `ordinals` | **Ordinals** | `0.27.1` | `4000` | `finance` |
| 152 | `originless` | **Originless** | `0.1.0` | `3232` | `utilities, data` |
| 153 | `paperclip` | **Paperclip** | `2026.1012.0` | `8860` | `ai` |
| 154 | `papra` | **Papra** | `26.6.2-rootless` | `23892` | `utilities, data` |
| 155 | `passky-client` | **Passky Client** | `8.1.1` | `5052` | `utilities, data` |
| 156 | `passky-server` | **Passky Server** | `9.0.0` | `5050` | `utilities, data` |
| 157 | `pastefy` | **Pastefy** | `7.1.6` | `9900` | `development` |
| 158 | `pearcircle-seeder` | **PearCircle Seeder** | `1.1.4` | `8731` | `network` |
| 159 | `peerswap` | **PeerSwap** | `7.0.2` | `1984` | `finance` |
| 160 | `perplexica` | **Vane** | `v1.12.2` | `3444` | `ai` |
| 161 | `picoclaw` | **PicoClaw** | `v0.3.1-launcher` | `18800` | `ai` |
| 162 | `picsur` | **Picsur** | `0.5.6` | `8286` | `photography, utilities, data` |
| 163 | `plane` | **Plane** | `alpine3.23` | `8762` | `utilities, data` |
| 164 | `pocketbase` | **PocketBase** | `0.40.5` | `5400` | `development` |
| 165 | `pogolo` | **pogolo** | `v1.x` | `5663` | `finance` |
| 166 | `poznote` | **Poznote** | `6.127.0` | `8389` | `utilities, data` |
| 167 | `public-pool` | **Public Pool** | `1.25.3` | `2019` | `finance` |
| 168 | `public-pool-web` | **Public Pool's Web** | `0.2.0` | `2021` | `finance` |
| 169 | `pyload-ng` | **pyload-ng** | `0.5.0` | `26317` | `utilities, data` |
| 170 | `readeck` | **Readeck** | `0.23.4` | `20887` | `books, utilities, data` |
| 171 | `readur` | **Readur** | `3.1.0` | `19289` | `photography, utilities, data` |
| 172 | `reitti` | **Reitti** | `5.8.0` | `20684` | `photography, utilities, data` |
| 173 | `remmina` | **Remmina** | `1.4.35` | `8764` | `network` |
| 174 | `restreamer` | **Restreamer** | `2.12.0` | `20264` | `utilities, data` |
| 175 | `ride-the-lightning` | **Ride The Lightning** | `v0.15.15` | `3001` | `finance` |
| 176 | `robosats` | **RoboSats** | `v0.8.7-alpha` | `12596` | `finance` |
| 177 | `rotki` | **rotki** | `1.44.1` | `23617` | `finance` |
| 178 | `route96` | **Route96** | `0.7.0` | `25904` | `social` |
| 179 | `rustdesk-server` | **RustDesk Server** | `1.27` | `21080` | `network, security` |
| 180 | `rusty-kaspad` | **Rusty Kaspad** | `v0.4.1` | `4321` | `finance` |
| 181 | `saifa` | **Saifa** | `v1.3.2` | `9989` | `finance` |
| 182 | `samourai-server` | **Samourai Server** | `1.21-alpine` | `3021` | `finance` |
| 183 | `satoshi-dashboard` | **Satoshi Dashboard** | `v1.1.0` | `8410` | `finance` |
| 184 | `satsale` | **SatSale** | `0.1.13` | `22702` | `finance` |
| 185 | `satsbook` | **Satsbook** | `2.1.0` | `3017` | `finance` |
| 186 | `satwatch` | **sat.watch** | `1.1.8` | `3883` | `finance` |
| 187 | `scanservjs` | **scanservjs** | `v3.3.0` | `2903` | `utilities, data` |
| 188 | `seafile` | **Seafile** | `14.0.9` | `8920` | `books, utilities, data` |
| 189 | `seedtool` | **Bitcoin Seed Tool** | `2.3.0` | `8147` | `finance` |
| 190 | `shopstr` | **Shopstr** | `0.7.5` | `30402` | `finance` |
| 191 | `sikka` | **Sikka** | `0.2.0` | `64552` | `finance` |
| 192 | `silo` | **Silo** | `RELEASE.2026-10-18T00-00-00Z` | `9130` | `utilities, data` |
| 193 | `simple-torrent` | **SimpleTorrent** | `1.3.9` | `18611` | `network` |
| 194 | `skybro` | **SkyBro** | `1.6.2` | `7437` | `network` |
| 195 | `slink` | **Slink** | `1.14.2` | `8811` | `photography, utilities, data` |
| 196 | `snapdrop` | **Snapdrop** | `version-b8b78cc2` | `22763` | `utilities, data` |
| 197 | `snort` | **Snort** | `v0.5.3` | `52027` | `social` |
| 198 | `snowflake` | **Tor Snowflake Proxy** | `v1.6.0` | `3800` | `network, security` |
| 199 | `solidtime` | **Solidtime** | `0.22.0` | `8770` | `utilities, data` |
| 200 | `spacebot` | **Spacebot** | `v0.5.0` | `19898` | `ai` |
| 201 | `sparkkiosk` | **Sparkkiosk** | `v1.0.0` | `21214` | `finance` |
| 202 | `specter-desktop` | **Specter Desktop** | `v2.1.11` | `25441` | `finance` |
| 203 | `sphinx-relay` | **Sphinx Relay** | `v2.5.2` | `3300` | `social` |
| 204 | `sqlitebrowser` | **SQLite Browser** | `3.13.1` | `8887` | `development` |
| 205 | `squeaknode` | **Squeaknode** | `v0.3.4` | `12994` | `social` |
| 206 | `squeakroad` | **Squeak Road** | `v0.1.14` | `18200` | `finance` |
| 207 | `stash` | **Stash** | `1.0.1` | `5173` | `ai` |
| 208 | `strix` | **Strix** | `2.2.0` | `24438` | `automation` |
| 209 | `super-productivity` | **Super Productivity** | `19.2.0` | `8020` | `utilities, data` |
| 210 | `sure` | **Sure** | `0.7.5` | `3064` | `finance` |
| 211 | `suredbits-wallet` | **Suredbits Wallet** | `1.9.7` | `3020` | `finance` |
| 212 | `sv2-ui` | **Stratum V2 UI** | `0.7.0` | `8077` | `finance` |
| 213 | `swingmusic` | **Swing Music** | `v3.0.0` | `1970` | `media, music` |
| 214 | `synapse` | **Synapse** | `1.163.0` | `20060` | `social` |
| 215 | `syslog-ng` | **Syslog-ng** | `0.17.1` | `5142` | `network` |
| 216 | `tdex` | **TDEX Provider** | `2.6.4-alpine` | `9094` | `finance` |
| 217 | `technitium-dns` | **Technitium DNS Server** | `15.6.2` | `5380` | `network, security` |
| 218 | `telegrapho` | **Telegrapho** | `1.0.1` | `3712` | `network` |
| 219 | `termix` | **Termix** | `2.9.2` | `6444` | `development` |
| 220 | `thelounge` | **The Lounge** | `4.4.3` | `9003` | `social` |
| 221 | `thinkdashboard` | **ThinkDashboard** | `v0.7.6` | `8229` | `utilities, data` |
| 222 | `threema` | **Threema Web** | `2.6.5` | `8855` | `utilities, data` |
| 223 | `thunderhub` | **ThunderHub** | `0.19.0` | `24188` | `finance` |
| 224 | `torbrowser` | **Tor Browser** | `15.0.17` | `5832` | `network` |
| 225 | `torq` | **Torq** | `2.2.9` | `7028` | `finance` |
| 226 | `toshi-moto` | **Toshi Moto** | `1.37.3` | `8021` | `finance` |
| 227 | `transmute` | **Transmute** | `2.1.1` | `3313` | `utilities, data` |
| 228 | `trip` | **Trip** | `1.50.1` | `8980` | `utilities, data` |
| 229 | `twenty` | **Twenty** | `2.50.1` | `2020` | `utilities, data` |
| 230 | `urbit` | **Urbit** | `v4.6` | `21955` | `network` |
| 231 | `urbit-bitcoin-connector` | **Urbit Bitcoin Connector** | `latest` | `9090` | `finance` |
| 232 | `usocial` | **usocial** | `v0.1.5-buster` | `8448` | `social` |
| 233 | `valorgrid` | **ValorGrid** | `3.36.3` | `1325` | `finance` |
| 234 | `vert` | **VERT** | `257bcb3` | `3884` | `utilities, data` |
| 235 | `wanderer` | **Wanderer** | `0.21.0` | `3111` | `utilities, data` |
| 236 | `wavelog` | **Wavelog** | `3.2.4` | `22784` | `social` |
| 237 | `wealthfolio` | **Wealthfolio** | `3.10.0` | `19334` | `finance` |
| 238 | `webcheck` | **WebCheck** | `2.3.0` | `3093` | `network, security` |
| 239 | `wger` | **wger** | `alpine3.22` | `8450` | `utilities, data` |
| 240 | `wingfit` | **Wingfit** | `5.3.1` | `8950` | `utilities, data` |
| 241 | `woofbot` | **WoofBot (without Lightning)** | `0.9.8` | `22182` | `finance` |
| 242 | `woofbot-lnd` | **WoofBot (LND)** | `v0.9.8` | `21412` | `finance` |
| 243 | `yamtrack` | **Yamtrack** | `0.26.3` | `8742` | `media` |
| 244 | `yucca` | **Yucca** | `0.13.4` | `9910` | `automation` |
| 245 | `yuvomi` | **Yuvomi** | `2.79.0` | `26765` | `utilities, data` |
| 246 | `zabbix` | **Zabbix** | `7.4.16` | `10052` | `network, security` |
| 247 | `zen` | **Zen** | `1.5.0` | `8894` | `utilities, data` |
| 248 | `zeronote` | **ZeroNote** | `1.0.12` | `18817` | `utilities, data` |
| 249 | `zoraxy` | **Zoraxy** | `v3.3.4` | `8400` | `network, security` |
