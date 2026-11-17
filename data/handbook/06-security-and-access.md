# Security and Access

## Accounts
Single sign-on through Okta for everything. Hardware keys or an authenticator
app are required; SMS codes are not accepted. Password managers are provided
(1Password) and shared credentials outside it are a policy violation.

## Device requirements
Full-disk encryption, automatic screen lock within five minutes, and the MDM
agent installed. Personal devices may access email and Slack only. Code and
customer data stay on company hardware.

## Production access
Production access is granted per role and reviewed quarterly. Standing access
to customer data is limited to the on-call engineer and the three people on the
platform team. Everyone else requests temporary access through the `#access`
workflow, which grants it for **eight hours** and logs the reason.

## Reporting something
If you think you have leaked a credential, clicked something you should not
have, or lost a device, write in `#security-incident` immediately. There is no
penalty for reporting fast, and there is a real one for staying quiet.

Out of hours, page the security on-call through PagerDuty.

## Customer data requests
Any request to export, delete or share customer data — whether it comes from
the customer, a colleague or a regulator — goes through Legal. Do not run the
query yourself first.

## Vendor review
New SaaS tools that touch customer data need a vendor review before purchase.
Submit in the `#security` channel; reviews take about a week. Tools that do not
touch customer data need only your manager's budget approval.
