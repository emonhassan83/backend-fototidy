import { Request, Response } from 'express'
import catchAsync from '../../utils/catchAsync'
import { subscriptionService } from './subscription.service'
import sendResponse from '../../utils/sendResponse'
import { SUBSCRIPTION_STATUS } from './subscription.constants';

const verifySubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await subscriptionService.verifyAndSaveSubscription(req.user._id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Subscription verified & recorded successfully',
    data: result,
  });
});

const handleAppleServerNotification = catchAsync(async (req: Request, res: Response) => {
  const result = await subscriptionService.handleAppleWebhook(req.body);
  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Webhook received successfully',
    data: result,
  });
});

const getAllSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await subscriptionService.getAllSubscription(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'All subscriptions fetched successfully !',
    meta: result?.meta,
    data: result?.data,
  })
})

const getMySubscription = catchAsync(async (req: Request, res: Response) => {
  req.query['user'] = req.user._id.toString()
  req.query['status'] = SUBSCRIPTION_STATUS.active
  const result = await subscriptionService.getAllSubscription(req.query)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'My subscriptions fetched successfully!',
    data: result?.data[0],
  })
})

const getSubscriptionById = catchAsync(async (req: Request, res: Response) => {
  const result = await subscriptionService.getSubscriptionById(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Subscription fetched successfully !',
    data: result,
  })
})

const chancelSubscription = catchAsync(async (req, res) => {
  const result = await subscriptionService.chancelSubscriptionFromDB(req.user._id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Subscription cancellation request submitted successfully!',
    data: result,
  })
})

const deleteSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await subscriptionService.deleteSubscription(req.params.id)

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Subscription deleted successfully',
    data: result,
  })
})

export const subscriptionController = {
  verifySubscription,
  handleAppleServerNotification,
  getAllSubscription,
  getSubscriptionById,
  getMySubscription,
  chancelSubscription,
  deleteSubscription,
}
