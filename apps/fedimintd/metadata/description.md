# Fedimint

> Federated Chaumian E-Cash Mint for Bitcoin

Fedimint is a federated Chaumian E-Cash Mint to custody and transact bitcoin in a community. It allows groups of trusted individuals, called guardians, to jointly operate a multi-signature e-cash mint.
# Setting Up a Federation
You can create a Fedimint in two ways:

  - Single Guardian Federation — A single guardian operating their own mint.

  - Group Federation — Multiple guardians running the mint together (minimum of 4 guardians).

[See here for more deployment recommendations](https://github.com/fedimint/fedimint/blob/master/docs/deploying.md)
# Step By Step Ceremony
1. Install & Launch this Fedimint app (fedimintd) on your Umbrel
   Each participating guardian runs their own instance of fedimintd.

2. Find Your Guardian Password
   Umbrel provides a unique guardian admin password for the app. It is shown when you first open the app and can be found again through the app's settings or credentials menu.

3. Generate Setup Code
   After signing in, a unique setup code is generated for each guardian.

4. Exchange Setup Codes
   All guardians must share their setup codes with each other (every guardian needs every other guardian's code).

5. Distributed Key Generation (DKG)
   Once all setup codes are entered, the DKG process begins. This is where the federation's cryptographic keys are jointly created.
   This step may take some time while all guardians connect.

6. Federation Complete!
   Once DKG finishes, your federation is live. Your guardian dashboard will be available for monitoring. You now have a functioning Fedimint!

# Enabling Lightning Payments
Fedimint supports Lightning payments via a Lightning Gateway. To use Lightning in your federation, there are two options:
1. Run your own! - [Deploy a Lightning Gateway on your Umbrel](https://apps.umbrel.com/app/fedimint-gateway).
2. Use an existing Lightning Gateway. [Reach out on Discord to get setup](https://chat.fedimint.org).

## Default Credentials
- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.

## Inter-App Connections

This package integrates with **bitcoin** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `v0.12.2`
- **Website**: https://fedimint.org/
- **Source Repository**: https://github.com/fedimint/fedimint
- **Support**: https://github.com/fedimint/fedimint/issues
