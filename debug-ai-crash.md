# [CLOSED] AI助手Tab点击后应用卡死崩溃

## 根因
`withNoShopGuard(MerchantAssistant, 'AI助手')` 在 `RootTabs` 组件的 JSX 渲染函数内调用，每次渲染都创建新的 HOC 包装组件，导致 React 的 reconciliation 机制将其视为完全不同的组件类型，从而：
1. 卸载旧的 MerchantAssistant
2. 重新挂载新的 MerchantAssistant
3. MerchantAssistant 的 useEffect 在挂载时 dispatch `SET_AI_MESSAGES` 状态变更
4. 状态变更触发 RootTabs 重渲染
5. 再次创建新 HOC 包装 → 死循环 → 卡死崩溃

## 修复方案
将 6 个 `withNoShopGuard(...)` 调用移到**模块级别**（RootTabs 函数外部），预创建稳定引用的包装组件：
```javascript
const GuardedHomePage = withNoShopGuard(HomePage, '首页');
const GuardedVerifyOrder = withNoShopGuard(VerifyOrder, '核销');
const GuardedCustomerService = withNoShopGuard(CustomerService, '客服');
const GuardedStockManage = withNoShopGuard(StockManage, '出入库');
const GuardedInternalChat = withNoShopGuard(InternalChat, '内部');
const GuardedMerchantAssistant = withNoShopGuard(MerchantAssistant, 'AI助手');
```

Tab.Screen 改为使用这些预包装组件。

## 版本
- 修复版：v5.85.1
- commit：f287041
- 构建：expo export --platform android 成功
