import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

export async function createPaymentLink(
  invoiceId: string,
  amount: number,
  description: string
): Promise<string> {
  try {
    // Convert amount to pence (Stripe uses smallest currency unit)
    const amountInPence = Math.round(amount * 100)

    // Create a payment link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Invoice ${invoiceId}`,
              description: description,
            },
            unit_amount: amountInPence,
          },
          quantity: 1,
        },
      ],
      after_completion: {
        type: 'hosted_confirmation',
        hosted_confirmation: {
          custom_message: 'Thank you for your payment!',
        },
      },
    })

    return paymentLink.url
  } catch (error) {
    console.error('Error creating Stripe payment link:', error)
    throw new Error('Failed to create payment link')
  }
}
