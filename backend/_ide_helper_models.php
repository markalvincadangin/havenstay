<?php

// @formatter:off
// phpcs:ignoreFile
/**
 * A helper file for your Eloquent Models
 * Copy the phpDocs from this file to the correct Model,
 * And remove them from this file, to prevent double declarations.
 *
 * @author Barry vd. Heuvel <barryvdh@gmail.com>
 */


namespace App\Models{
/**
 * @property int $add_on_id
 * @property string $item_name
 * @property numeric $default_monthly_rate
 * @property bool|null $is_active
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Contract> $contracts
 * @property-read int|null $contracts_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AddOnRegistry newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AddOnRegistry newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AddOnRegistry query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AddOnRegistry whereAddOnId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AddOnRegistry whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AddOnRegistry whereDefaultMonthlyRate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AddOnRegistry whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AddOnRegistry whereItemName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AddOnRegistry whereUpdatedAt($value)
 */
	class AddOnRegistry extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property string $action
 * @property string $target_table
 * @property int $record_id
 * @property array<array-key, mixed>|null $old_value
 * @property array<array-key, mixed>|null $new_value
 * @property int|null $changed_by
 * @property string|null $correlation_id
 * @property \Illuminate\Support\Carbon|null $changed_at
 * @property-read \App\Models\User|null $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereChangedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereChangedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereCorrelationId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereNewValue($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereOldValue($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereRecordId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AuditLog whereTargetTable($value)
 */
	class AuditLog extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $bed_space_id
 * @property int $room_id
 * @property string $bed_label
 * @property string|null $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Room|null $room
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BedSpace newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BedSpace newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BedSpace query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BedSpace whereBedLabel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BedSpace whereBedSpaceId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BedSpace whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BedSpace whereRoomId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BedSpace whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BedSpace whereUpdatedAt($value)
 */
	class BedSpace extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $billing_id
 * @property int $contract_id
 * @property \Illuminate\Support\Carbon $billing_period_from
 * @property \Illuminate\Support\Carbon $billing_period_to
 * @property \Illuminate\Support\Carbon $due_date
 * @property string|null $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Contract|null $contract
 * @property-read float $balance
 * @property-read float $total_amount
 * @property-read float $total_paid
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\BillingLineItem> $lineItems
 * @property-read int|null $line_items_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Payment> $payments
 * @property-read int|null $payments_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Billing newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Billing newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Billing query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Billing whereBillingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Billing whereBillingPeriodFrom($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Billing whereBillingPeriodTo($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Billing whereContractId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Billing whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Billing whereDueDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Billing whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Billing whereUpdatedAt($value)
 */
	class Billing extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $billing_line_item_id
 * @property int $billing_id
 * @property string $item_type
 * @property string $item_description
 * @property numeric $amount
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Billing $billing
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingLineItem newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingLineItem newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingLineItem query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingLineItem whereAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingLineItem whereBillingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingLineItem whereBillingLineItemId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingLineItem whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingLineItem whereItemDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingLineItem whereItemType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BillingLineItem whereUpdatedAt($value)
 */
	class BillingLineItem extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $contract_id
 * @property int $tenant_id
 * @property int $bed_space_id
 * @property int $created_by
 * @property \Illuminate\Support\Carbon $move_in_date
 * @property \Illuminate\Support\Carbon|null $expected_move_out_date
 * @property \Illuminate\Support\Carbon|null $actual_move_out_date
 * @property numeric|null $deposit_amount
 * @property numeric|null $monthly_rate_override
 * @property string|null $status
 * @property bool|null $is_cleared
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\AddOnRegistry> $addOns
 * @property-read int|null $add_ons_count
 * @property-read \App\Models\BedSpace $bedSpace
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Billing> $billings
 * @property-read int|null $billings_count
 * @property-read \App\Models\User|null $creator
 * @property-read \App\Models\Billing|null $latestBilling
 * @property-read \App\Models\Room|null $room
 * @property-read \App\Models\Tenant|null $tenant
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereActualMoveOutDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereBedSpaceId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereContractId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereCreatedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereDepositAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereExpectedMoveOutDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereIsCleared($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereMonthlyRateOverride($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereMoveInDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereTenantId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Contract withoutTrashed()
 */
	class Contract extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property int $contract_id
 * @property int $add_on_id
 * @property numeric $actual_rate
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\AddOnRegistry $addOn
 * @property-read \App\Models\Contract|null $contract
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContractAddOn newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContractAddOn newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContractAddOn query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContractAddOn whereActualRate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContractAddOn whereAddOnId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContractAddOn whereContractId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContractAddOn whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContractAddOn whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContractAddOn whereUpdatedAt($value)
 */
	class ContractAddOn extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $payment_id
 * @property int $billing_id
 * @property int $processed_by
 * @property numeric $amount_paid
 * @property \Illuminate\Support\Carbon $payment_date
 * @property string|null $payment_method
 * @property string|null $reference_number
 * @property string|null $remarks
 * @property string|null $voided_at
 * @property int|null $voided_by
 * @property string|null $void_reason
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property-read \App\Models\Billing $billing
 * @property-read \App\Models\User|null $processor
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment whereAmountPaid($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment whereBillingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment wherePaymentDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment wherePaymentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment wherePaymentMethod($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment whereProcessedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment whereReferenceNumber($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment whereRemarks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment whereVoidReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment whereVoidedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Payment whereVoidedBy($value)
 */
	class Payment extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $role_id
 * @property string $role_name
 * @property string|null $description
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\User> $users
 * @property-read int|null $users_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role whereRoleId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role whereRoleName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Role whereUpdatedAt($value)
 */
	class Role extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $room_id
 * @property string $room_code
 * @property string|null $room_type
 * @property int|null $capacity
 * @property numeric $monthly_rate
 * @property string|null $status
 * @property array<array-key, mixed>|null $amenities
 * @property string|null $description
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\BedSpace> $bedSpaces
 * @property-read int|null $bed_spaces_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room whereAmenities($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room whereCapacity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room whereMonthlyRate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room whereRoomCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room whereRoomId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room whereRoomType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Room withoutTrashed()
 */
	class Room extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $reading_id
 * @property int $room_id
 * @property int|null $billing_id
 * @property string $utility_type
 * @property \Illuminate\Support\Carbon $reading_date
 * @property numeric $reading_value
 * @property int $recorded_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Billing|null $billing
 * @property-read \App\Models\User|null $recorder
 * @property-read \App\Models\Room|null $room
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RoomMeterReading newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RoomMeterReading newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RoomMeterReading query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RoomMeterReading whereBillingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RoomMeterReading whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RoomMeterReading whereReadingDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RoomMeterReading whereReadingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RoomMeterReading whereReadingValue($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RoomMeterReading whereRecordedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RoomMeterReading whereRoomId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RoomMeterReading whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|RoomMeterReading whereUtilityType($value)
 */
	class RoomMeterReading extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $tenant_id
 * @property string $first_name
 * @property string $last_name
 * @property string $contact_number
 * @property string $email
 * @property string $emergency_contact_name
 * @property string $emergency_contact_number
 * @property string $address
 * @property string|null $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant search(string $term)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant whereAddress($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant whereContactNumber($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant whereEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant whereEmergencyContactName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant whereEmergencyContactNumber($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant whereFirstName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant whereLastName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant whereTenantId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant withRichContext()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Tenant withoutTrashed()
 */
	class Tenant extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id
 * @property string $action
 * @property string $txn_reference
 * @property string|null $status
 * @property int|null $initiated_by
 * @property array<array-key, mixed>|null $details
 * @property string|null $error_message
 * @property string|null $correlation_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property-read \App\Models\User|null $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransactionLog newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransactionLog newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransactionLog query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransactionLog whereAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransactionLog whereCorrelationId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransactionLog whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransactionLog whereDetails($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransactionLog whereErrorMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransactionLog whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransactionLog whereInitiatedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransactionLog whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TransactionLog whereTxnReference($value)
 */
	class TransactionLog extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $user_id
 * @property int $role_id
 * @property string $first_name
 * @property string $last_name
 * @property string $username
 * @property string $email
 * @property string $password_hash
 * @property bool|null $is_active
 * @property \Illuminate\Support\Carbon|null $last_login_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Notifications\DatabaseNotificationCollection<int, \Illuminate\Notifications\DatabaseNotification> $notifications
 * @property-read int|null $notifications_count
 * @property-read \App\Models\Role $role
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \Laravel\Sanctum\PersonalAccessToken> $tokens
 * @property-read int|null $tokens_count
 * @method static \Database\Factories\UserFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereFirstName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereLastLoginAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereLastName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User wherePasswordHash($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereRoleId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereUsername($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User withoutTrashed()
 */
	class User extends \Eloquent {}
}

