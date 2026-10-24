---
title: Terraform state hygiene
description: Small habits that keep Terraform state safe, shareable, and boring.
date: 2026-09-12
tags: [terraform, iac]
---

State is the most sensitive file in your infrastructure repo. A few habits go a long way.

## Use a remote backend with locking

```hcl
terraform {
  backend "s3" {
    bucket         = "my-org-tfstate"
    key            = "prod/network/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "tfstate-locks"
    encrypt        = true
  }
}
```

## Keep states small

Split by blast radius: networking, data stores, and application layers each get their own state. Smaller states plan faster and a bad apply can only hurt so much.

## Never edit state by hand

Prefer `terraform state mv` and `terraform import` over editing JSON. If you must touch state, take a backup first.
