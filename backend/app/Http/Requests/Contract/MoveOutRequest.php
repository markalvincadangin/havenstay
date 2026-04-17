<?php

namespace App\Http\Requests\Contract;

use Illuminate\Foundation\Http\FormRequest;

class MoveOutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'actual_move_out' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
