# BTCPay Server

> Accept Bitcoin payments with 0 fees & no 3rd party

BTCPay Server is a payment processor that allows you to receive payments in Bitcoin (and altcoins) directly, with no fees, transaction cost or a middleman. It is a non-custodial invoicing system which eliminates the involvement of a third-party.

Payments with BTCPay Server go directly to your wallet, which increases the privacy and security. Your private keys are never uploaded to your Runtipi. There is no address re-use, since each invoice generates a new address deriving from your xpubkey.

You can not only attach an unlimited number of stores and use the Lightning Network but also become a payment processor for others. Thanks to the apps built on top of it, you can use BTCPay to receive donations, start a crowdfunding campaign or have an in-store Point of Sale.

Please note: Due to your BTCPay instance running on your local network connecting remote applications, such as Shopify or WordPress for example, will fail to connect, unless you configure the dynamic DNS feature (see: https://docs.btcpayserver.org/Deployment/DynamicDNS).

## Inter-App Connections

This package integrates with **bitcoin, lightning** on the Runtipi shared network (`tipi_main_network`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.

## Links
- **Upstream Version**: `2.4.5`
- **Website**: https://btcpayserver.org
- **Source Repository**: https://github.com/btcpayserver/btcpayserver
- **Support**: https://chat.btcpayserver.org
