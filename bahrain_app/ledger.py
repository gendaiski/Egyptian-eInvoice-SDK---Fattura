"""Small, jurisdiction-scoped accounting core for the Bahrain review edition.

All amounts are integer fils. This prepares books and a VAT workpaper; it does
not claim to reproduce every NBR return box or submit anything to the NBR.
"""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

ACCOUNTS = {
    "1000": "Bank",
    "1100": "Accounts receivable",
    "1300": "Fixed assets",
    "2000": "Accounts payable",
    "2100": "Output VAT",
    "1200": "Recoverable input VAT",
    "3000": "Owner equity",
    "4000": "Sales revenue",
    "5000": "Purchases and expenses",
    "5100": "Payroll and other expenses",
}
TREATMENTS = {"standard", "zero", "exempt", "out_of_scope"}


def fils(value):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError("Enter a valid BHD amount") from None
    if not amount.is_finite() or amount <= 0 or amount != amount.quantize(Decimal("0.001")):
        raise ValueError("Use a positive BHD amount with up to three decimal places")
    return int(amount * 1000)


def bhd(value):
    return f"{Decimal(value) / 1000:.3f}"


def signed_fils(value):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError("Enter a valid signed BHD amount") from None
    if not amount.is_finite() or amount == 0 or amount != amount.quantize(Decimal("0.001")):
        raise ValueError("Use a nonzero BHD amount with up to three decimal places")
    return int(amount * 1000)


def vat_for(net_fils, treatment):
    if treatment not in TREATMENTS:
        raise ValueError("Choose a supported VAT treatment")
    if treatment != "standard":
        return 0
    return int((Decimal(net_fils) * Decimal("0.10")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def journal_lines(kind, net_fils, vat_fils, recoverable=False):
    gross = net_fils + vat_fils
    if kind == "sale":
        lines = [("1100", gross, 0), ("4000", 0, net_fils)]
        if vat_fils:
            lines.append(("2100", 0, vat_fils))
    elif kind == "purchase":
        deductible = vat_fils if recoverable else 0
        lines = [("5000", net_fils + vat_fils - deductible, 0), ("2000", 0, gross)]
        if deductible:
            lines.append(("1200", deductible, 0))
    else:
        raise ValueError("Only sales and purchases are supported")
    validate_journal(lines)
    return lines


def payment_lines(kind, amount_fils):
    if kind == "sale":
        lines = [("1000", amount_fils, 0), ("1100", 0, amount_fils)]
    elif kind == "purchase":
        lines = [("2000", amount_fils, 0), ("1000", 0, amount_fils)]
    else:
        raise ValueError("Payment must be linked to a sale or purchase")
    validate_journal(lines)
    return lines


def validate_journal(lines):
    if not lines or sum(x[1] for x in lines) != sum(x[2] for x in lines):
        raise ValueError("Journal debits and credits must balance")
    if any(a not in ACCOUNTS or d < 0 or c < 0 or (d and c) or not (d or c) for a, d, c in lines):
        raise ValueError("Invalid journal line")


def return_workpaper(documents):
    """Aggregate recorded classifications; official NBR box mapping still needs review."""
    summary = {k: 0 for k in (
        "standard_sales_net", "standard_sales_vat", "zero_sales_net", "exempt_sales_net",
        "out_of_scope_sales_net", "purchases_net", "recoverable_input_vat", "blocked_input_vat",
    )}
    for d in documents:
        kind, treatment = d["kind"], d["vat_treatment"]
        net, vat = int(d["net_fils"]), int(d["vat_fils"])
        if kind == "sale":
            summary[f"{treatment}_sales_net"] += net
            if treatment == "standard":
                summary["standard_sales_vat"] += vat
        elif kind == "purchase":
            summary["purchases_net"] += net
            summary["recoverable_input_vat" if d["recoverable"] else "blocked_input_vat"] += vat
    summary["net_vat_due"] = summary["standard_sales_vat"] - summary["recoverable_input_vat"]
    return summary
